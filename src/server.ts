import type { DatabaseSync } from "node:sqlite";
import Fastify from "fastify";
import multipart from "@fastify/multipart";

import type { AppConfig } from "./config.js";
import { registerDeploymentRoutes } from "./deployments/deployment-routes.js";

export async function createApiServer(
  config: AppConfig,
  db: DatabaseSync,
): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger: true,
    bodyLimit: config.bodyLimitBytes,
  });

  await app.register(multipart, {
    throwFileSizeLimit: true,
    limits: {
      fileSize: config.maxSingleFileBytes + 1,
      files: config.maxFileCount,
      fields: config.maxMultipartFields,
      fieldSize: config.maxMultipartFieldSize,
      parts: config.maxMultipartParts,
    },
  });

  app.get("/health", async () => ({ ok: true }));

  await registerDeploymentRoutes(app, { config, db });

  return app;
}

export async function startApiServer(
  config: AppConfig,
  db: DatabaseSync,
): Promise<ReturnType<typeof Fastify>> {
  const app = await createApiServer(config, db);
  await app.listen({ host: config.host, port: config.port });
  return app;
}
