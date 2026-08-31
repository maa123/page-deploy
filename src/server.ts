import type { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";

import type { AppConfig } from "./config.js";
import { registerDeploymentRoutes } from "./deployments/deployment-routes.js";
import type { TrustProxySetting } from "./http/trust-proxy.js";

type FastifyTrustProxyOption = TrustProxySetting;

export async function createApiServer(
  config: AppConfig,
  db: DatabaseSync,
): Promise<FastifyInstance> {
  const trustProxy: FastifyTrustProxyOption = config.trustProxy;
  const app = Fastify({
    logger: true,
    bodyLimit: config.bodyLimitBytes,
    trustProxy: trustProxy as unknown as boolean | string | string[] | ((address: string, hop: number) => boolean),
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

  await registerDeploymentRoutes(app as unknown as FastifyInstance, { config, db });

  return app as unknown as FastifyInstance;
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
