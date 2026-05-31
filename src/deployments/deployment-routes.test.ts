import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import Fastify from "fastify";
import multipart from "@fastify/multipart";

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

  async function buildApp(): Promise<ReturnType<typeof Fastify>> {
    const app = Fastify();
    await app.register(multipart, {
      limits: {
        fileSize: 10_485_761,
        files: 1000,
        fields: 4,
        fieldSize: 256,
        parts: 1006,
      },
      throwFileSizeLimit: true,
    });
    await registerDeploymentRoutes(app, createConfig());
    apps.push(app);
    return app;
  }

  it("returns 401 when x-api-key header is missing", async () => {
    const app = await buildApp();

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

  it("returns 401 when x-api-key header is invalid", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/test/deployments",
      headers: {
        "x-api-key": "wrong-api-key",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      status: "failed",
      projectId: "test",
      errorMessage: "unauthorized",
    });
  });

  it("continues request handling when x-api-key is valid", async () => {
    const app = await buildApp();

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

  it("uses the first x-api-key value when header is repeated", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/test/deployments",
      headers: {
        "x-api-key": ["expected-api-key", "ignored-api-key"],
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
