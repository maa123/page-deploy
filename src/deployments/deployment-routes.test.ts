import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import Fastify from "fastify";

import type { AppConfig } from "../config.js";
import { registerDeploymentRoutes } from "./deployment-routes.js";

function createConfig(): AppConfig {
  return {
    cloudflareApiToken: "cf-token",
    cloudflareAccountId: "cf-account",
    apiKey: "expected-api-key",
    host: "127.0.0.1",
    port: 3000,
    maxUploadBytes: 52_428_800,
    maxFileCount: 1000,
    maxSingleFileBytes: 10_485_760,
    maxMultipartFields: 4,
    maxMultipartFieldSize: 256,
    maxMultipartParts: 1006,
    bodyLimitBytes: 52_686_336,
  };
}

describe("registerDeploymentRoutes API key auth", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("returns 401 when x-api-key header is missing", async () => {
    const app = Fastify();
    apps.push(app);
    await registerDeploymentRoutes(app, createConfig());

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/test/deployments",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      status: "failed",
      projectId: "test",
      errorMessage: "unauthorized",
    });
  });

  it("continues request handling when x-api-key is valid", async () => {
    const app = Fastify();
    apps.push(app);
    await registerDeploymentRoutes(app, createConfig());

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/test/deployments",
      headers: {
        "x-api-key": "expected-api-key",
      },
    });

    assert.equal(response.statusCode, 415);
    assert.deepEqual(response.json(), {
      status: "failed",
      projectId: "test",
      errorMessage: "Content-Type must be multipart/form-data",
    });
  });
});
