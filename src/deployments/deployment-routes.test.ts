import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import Fastify from "fastify";
import multipart from "@fastify/multipart";

import { hashSecret } from "../auth/api-key.js";
import type { AppConfig } from "../config.js";
import { openMemoryDatabase } from "../db/database.js";
import { insertApiKey } from "../db/repositories/api-keys.js";
import { insertProject } from "../db/repositories/projects.js";
import { PERMISSION_DEPLOYMENT_CREATE } from "../auth/permissions.js";
import { registerDeploymentRoutes } from "./deployment-routes.js";

function createConfig(): AppConfig {
  return {
    cloudflareApiToken: "cf-token",
    cloudflareAccountId: "cf-account",
    sqlitePath: ":memory:",
    host: "127.0.0.1",
    port: 3000,
    adminHost: "127.0.0.1",
    adminPort: 3001,
    adminSessionCookieSecure: false,
    sessionSecret: "x".repeat(32),
    maxUploadBytes: 52_428_800,
    maxFileCount: 1000,
    maxSingleFileBytes: 10_485_760,
    maxMultipartFields: 4,
    maxMultipartFieldSize: 256,
    maxMultipartParts: 1006,
    bodyLimitBytes: 52_686_336,
  };
}

describe("registerDeploymentRoutes Bearer auth", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildAppWithKey(): Promise<{
    app: ReturnType<typeof Fastify>;
    projectId: string;
    bearer: string;
  }> {
    const db = openMemoryDatabase();
    const config = createConfig();
    const projectId = randomUUID();
    const keyId = "testkeyid01";
    const secret = "mysecretvalue1234567890ab";
    const secretHash = await hashSecret(secret);

    insertProject(db, {
      id: projectId,
      slug: "my-site",
      cfAccountId: "cf-account",
      cfProjectName: "my-pages-site",
      createdAt: new Date().toISOString(),
    });

    insertApiKey(db, {
      id: randomUUID(),
      projectId,
      keyId,
      secretHash,
      permissions: [PERMISSION_DEPLOYMENT_CREATE],
      createdAt: new Date().toISOString(),
    });

    const app = Fastify();
    await app.register(multipart, {
      limits: {
        fileSize: config.maxSingleFileBytes + 1,
        files: config.maxFileCount,
        fields: config.maxMultipartFields,
        fieldSize: config.maxMultipartFieldSize,
        parts: config.maxMultipartParts,
      },
      throwFileSizeLimit: true,
    });
    await registerDeploymentRoutes(app, { config, db });
    apps.push(app);
    return {
      app,
      projectId,
      bearer: `Bearer dep_live_${keyId}_${secret}`,
    };
  }

  it("returns 401 when Authorization header is missing", async () => {
    const { app, projectId } = await buildAppWithKey();
    const response = await app.inject({
      method: "POST",
      url: `/v1/projects/${projectId}/deployments`,
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().errorMessage, "unauthorized");
  });

  it("returns 401 when Bearer token is invalid", async () => {
    const { app, projectId } = await buildAppWithKey();
    const response = await app.inject({
      method: "POST",
      url: `/v1/projects/${projectId}/deployments`,
      headers: { authorization: "Bearer dep_live_invalid_token" },
    });
    assert.equal(response.statusCode, 401);
  });

  it("returns 401 for unknown key before multipart validation", async () => {
    const { app, projectId } = await buildAppWithKey();
    const response = await app.inject({
      method: "POST",
      url: `/v1/projects/${projectId}/deployments`,
      headers: {
        authorization: "Bearer dep_live_unknownkey_wrongsecretvalue1234567890",
      },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().errorMessage, "unauthorized");
  });

  it("returns 415 when authorized but Content-Type is not multipart", async () => {
    const { app, projectId, bearer } = await buildAppWithKey();
    const response = await app.inject({
      method: "POST",
      url: `/v1/projects/${projectId}/deployments`,
      headers: { authorization: bearer },
    });
    assert.equal(response.statusCode, 415);
  });

  it("returns 400 for invalid projectId UUID", async () => {
    const { app, bearer } = await buildAppWithKey();
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/not-a-uuid/deployments",
      headers: { authorization: bearer },
    });
    assert.equal(response.statusCode, 400);
  });
});
