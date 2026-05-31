import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { generateApiKey, hashSecret, verifyPassword } from "../auth/api-key.js";
import { isValidAllowedIpCidrEntry } from "../auth/ip-cidr.js";
import { DEFAULT_DEPLOY_PERMISSIONS } from "../auth/permissions.js";
import type { AppConfig } from "../config.js";
import {
  findApiKeyById,
  insertApiKey,
  listApiKeysByProject,
  revokeApiKey,
} from "../db/repositories/api-keys.js";
import {
  findProjectById,
  findProjectBySlug,
  insertProject,
  listProjects,
} from "../db/repositories/projects.js";
import { parseJsonStringArray } from "../db/json-columns.js";
import { isSqliteUniqueConstraint } from "../db/sqlite-errors.js";
import type { ApiKeyPublicRow } from "../db/repositories/api-keys.js";
import { findAdminByUsername } from "../db/repositories/admin-users.js";
import { requireAdminSession } from "./session.js";

const createProjectSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,127})$/),
  cfAccountId: z.string().min(1).max(64),
  cfProjectName: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,127})$/),
  productionBranch: z.string().min(1).max(256).optional(),
});

function createApiKeySchema(config: AppConfig) {
  return z.object({
    name: z.string().min(1).max(128).optional(),
    permissions: z.array(z.string().min(1)).optional(),
    allowedBranches: z.array(z.string().min(1).max(256)).optional(),
    maxUploadBytes: z
      .number()
      .int()
      .positive()
      .max(config.maxUploadBytes, {
        message: `maxUploadBytes cannot exceed server limit (${config.maxUploadBytes})`,
      })
      .optional(),
    maxFileCount: z
      .number()
      .int()
      .positive()
      .max(config.maxFileCount, {
        message: `maxFileCount cannot exceed server limit (${config.maxFileCount})`,
      })
      .optional(),
    allowedIpCidrs: z
      .array(z.string().min(1).max(128))
      .refine((entries) => entries.every(isValidAllowedIpCidrEntry), {
        message: "allowedIpCidrs must contain valid IPv4/IPv6 addresses or CIDR ranges",
      })
      .optional(),
    expiresAt: z.string().datetime().optional(),
  });
}

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

function toApiKeyResponse(row: ApiKeyPublicRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    keyId: row.key_id,
    name: row.name,
    permissions: parseJsonStringArray(row.permissions) ?? [],
    allowedBranches: parseJsonStringArray(row.allowed_branches),
    maxUploadBytes: row.max_upload_bytes,
    maxFileCount: row.max_file_count,
    allowedIpCidrs: parseJsonStringArray(row.allowed_ip_cidrs),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  config: AppConfig,
): Promise<void> {
  app.post("/admin/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid request" });
    }

    const admin = findAdminByUsername(db, parsed.data.username);
    if (!admin) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const valid = await verifyPassword(admin.password_hash, parsed.data.password);
    if (!valid) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    await request.session.regenerate();
    request.session.admin = {
      adminUserId: admin.id,
      username: admin.username,
    };

    return reply.send({ ok: true, username: admin.username });
  });

  app.post("/admin/logout", async (request, reply) => {
    await request.session.destroy();
    return reply.send({ ok: true });
  });

  app.get("/admin/projects", async (request, reply) => {
    if (!requireAdminSession(request, reply)) {
      return;
    }
    const projects = listProjects(db).map((row) => ({
      id: row.id,
      slug: row.slug,
      cfAccountId: row.cf_account_id,
      cfProjectName: row.cf_project_name,
      productionBranch: row.production_branch,
      status: row.status,
      createdAt: row.created_at,
    }));
    return reply.send({ projects });
  });

  app.post("/admin/projects", async (request, reply) => {
    if (!requireAdminSession(request, reply)) {
      return;
    }
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid request", details: parsed.error.flatten() });
    }

    if (findProjectBySlug(db, parsed.data.slug)) {
      return reply.code(409).send({ error: "project slug already exists" });
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    try {
      insertProject(db, {
        id,
        slug: parsed.data.slug,
        cfAccountId: parsed.data.cfAccountId,
        cfProjectName: parsed.data.cfProjectName,
        productionBranch: parsed.data.productionBranch,
        createdAt,
      });
    } catch (error) {
      if (isSqliteUniqueConstraint(error)) {
        return reply.code(409).send({ error: "project slug already exists" });
      }
      throw error;
    }

    return reply.code(201).send({
      id,
      slug: parsed.data.slug,
      cfAccountId: parsed.data.cfAccountId,
      cfProjectName: parsed.data.cfProjectName,
      productionBranch: parsed.data.productionBranch ?? null,
      status: "active",
      createdAt,
    });
  });

  app.get<{ Params: { id: string } }>("/admin/projects/:id/api-keys", async (request, reply) => {
    if (!requireAdminSession(request, reply)) {
      return;
    }
    const project = findProjectById(db, request.params.id);
    if (!project) {
      return reply.code(404).send({ error: "project not found" });
    }
    const keys = listApiKeysByProject(db, project.id).map(toApiKeyResponse);
    return reply.send({ apiKeys: keys });
  });

  app.post<{ Params: { id: string } }>("/admin/projects/:id/api-keys", async (request, reply) => {
    if (!requireAdminSession(request, reply)) {
      return;
    }
    const project = findProjectById(db, request.params.id);
    if (!project) {
      return reply.code(404).send({ error: "project not found" });
    }

    const parsed = createApiKeySchema(config).safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid request", details: parsed.error.flatten() });
    }

    const generated = await generateApiKey();
    const secretHash = await hashSecret(generated.secret);
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    insertApiKey(db, {
      id,
      projectId: project.id,
      keyId: generated.keyId,
      secretHash,
      name: parsed.data.name,
      permissions: parsed.data.permissions ?? [...DEFAULT_DEPLOY_PERMISSIONS],
      allowedBranches: parsed.data.allowedBranches,
      maxUploadBytes: parsed.data.maxUploadBytes,
      maxFileCount: parsed.data.maxFileCount,
      allowedIpCidrs: parsed.data.allowedIpCidrs,
      expiresAt: parsed.data.expiresAt,
      createdAt,
    });

    return reply.code(201).send({
      apiKey: {
        id,
        keyId: generated.keyId,
        plaintext: generated.plaintext,
        projectId: project.id,
        name: parsed.data.name ?? null,
        permissions: parsed.data.permissions ?? [...DEFAULT_DEPLOY_PERMISSIONS],
        createdAt,
      },
    });
  });

  app.post<{ Params: { id: string } }>("/admin/api-keys/:id/revoke", async (request, reply) => {
    if (!requireAdminSession(request, reply)) {
      return;
    }
    const existing = findApiKeyById(db, request.params.id);
    if (!existing) {
      return reply.code(404).send({ error: "api key not found" });
    }
    const revokedAt = new Date().toISOString();
    const updated = revokeApiKey(db, request.params.id, revokedAt);
    if (!updated) {
      return reply.code(409).send({ error: "api key already revoked" });
    }
    return reply.send({ ok: true, revokedAt });
  });
}
