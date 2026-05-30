import Fastify from "fastify";
import multipart from "@fastify/multipart";

import { loadConfig } from "./config.js";
import { registerDeploymentRoutes } from "./deployments/deployment-routes.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const app = Fastify({
    logger: true,
    bodyLimit: config.bodyLimitBytes,
  });

  // パーサ上限はサービス上限より大きくする。サイズ超過が途中で切り捨てられて
  // デプロイされないよう、materializeFile で 400 にする。
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

  await registerDeploymentRoutes(app, config);

  await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
