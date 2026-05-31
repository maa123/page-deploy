import type { DatabaseSync } from "node:sqlite";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import session from "@fastify/session";

import type { AppConfig } from "../config.js";
import { ADMIN_SESSION_MAX_AGE_MS } from "../config.js";
import { registerAdminRoutes } from "./routes.js";

export async function createAdminServer(
  config: AppConfig,
  db: DatabaseSync,
): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({ logger: { level: "info" } });

  await app.register(cookie);
  await app.register(session, {
    secret: config.sessionSecret,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.adminSessionCookieSecure,
      maxAge: ADMIN_SESSION_MAX_AGE_MS,
    },
  });

  await registerAdminRoutes(app, db, config);

  return app;
}

export async function startAdminServer(
  config: AppConfig,
  db: DatabaseSync,
): Promise<ReturnType<typeof Fastify>> {
  const app = await createAdminServer(config, db);
  await app.listen({ host: config.adminHost, port: config.adminPort });
  return app;
}
