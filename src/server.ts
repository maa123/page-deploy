import type { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";

import type { AppConfig } from "./config.js";
import { registerDeploymentRoutes } from "./deployments/deployment-routes.js";
import type { TrustProxySetting } from "./http/trust-proxy.js";

type FastifyTrustProxyOption = Exclude<TrustProxySetting, number> | ((address: string, hop: number) => boolean);

export async function createApiServer(
  config: AppConfig,
  db: DatabaseSync,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    bodyLimit: config.bodyLimitBytes,
    trustProxy: config.trustProxy as FastifyTrustProxyOption,
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
): Promise<FastifyInstance> {
  const app = await createApiServer(config, db);
  if (config.socketPath) {
    await app.listen({ path: config.socketPath });
  } else {
    await app.listen({ host: config.host, port: config.port });
  }
  return app;
}
