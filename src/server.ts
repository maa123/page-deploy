import Fastify from "fastify";
import multipart from "@fastify/multipart";

import { loadConfig } from "./config.js";
import { registerDeploymentRoutes } from "./deployments/deployment-routes.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const app = Fastify({ logger: true });

  await app.register(multipart, {
    limits: {
      fileSize: config.maxSingleFileBytes,
      files: config.maxFileCount,
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
