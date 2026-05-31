import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import { openMemoryDatabase } from "../db/database.js";
import { bootstrapAdminUser } from "./bootstrap.js";
import { registerAdminRoutes } from "./routes.js";

function createConfig(): AppConfig {
  return {
    cloudflareApiToken: "cf-token",
    cloudflareAccountId: "cf-account",
    sqlitePath: ":memory:",
    host: "127.0.0.1",
    port: 3000,
    adminHost: "127.0.0.1",
    adminPort: 3001,
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

describe("admin routes", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildApp(): Promise<ReturnType<typeof Fastify>> {
    const db = openMemoryDatabase();
    const config = createConfig();
    await bootstrapAdminUser(db, { username: "admin", password: "admin-password-12345" });

    const app = Fastify();
    await app.register(cookie);
    await app.register(session, {
      secret: config.sessionSecret,
      cookie: { httpOnly: true, sameSite: "lax", secure: false },
    });
    await registerAdminRoutes(app, db, config);
    apps.push(app);
    return app;
  }

  it("login, create project, issue api key", async () => {
    const app = await buildApp();

    const login = await app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { username: "admin", password: "admin-password-12345" },
    });
    assert.equal(login.statusCode, 200);

    const cookieHeader = login.headers["set-cookie"];
    assert.ok(cookieHeader);

    const createProject = await app.inject({
      method: "POST",
      url: "/admin/projects",
      headers: { cookie: String(cookieHeader) },
      payload: {
        slug: "my-site",
        cfAccountId: "cf-account",
        cfProjectName: "my-pages-site",
        productionBranch: "main",
      },
    });
    assert.equal(createProject.statusCode, 201);
    const projectId = z.object({ id: z.string().uuid() }).parse(createProject.json()).id;

    const createKey = await app.inject({
      method: "POST",
      url: `/admin/projects/${projectId}/api-keys`,
      headers: { cookie: String(cookieHeader) },
      payload: { name: "ci-key" },
    });
    assert.equal(createKey.statusCode, 201);
    const body = z
      .object({
        apiKey: z.object({
          plaintext: z.string(),
          keyId: z.string(),
        }),
      })
      .parse(createKey.json());
    assert.match(body.apiKey.plaintext, /^dep_live_/);
    assert.ok(body.apiKey.keyId);
  });
});
