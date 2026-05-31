import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { loadConfig, parsePositiveInt } from "./config.js";

describe("parsePositiveInt", () => {
  const original = process.env.TEST_PORT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TEST_PORT;
    } else {
      process.env.TEST_PORT = original;
    }
  });

  it("returns fallback when env var is not set", () => {
    delete process.env.TEST_PORT;
    assert.equal(parsePositiveInt("TEST_PORT", 8080), 8080);
  });

  it("returns fallback when env var is empty string", () => {
    process.env.TEST_PORT = "";
    assert.equal(parsePositiveInt("TEST_PORT", 8080), 8080);
  });

  it("accepts valid integers", () => {
    process.env.TEST_PORT = "3000";
    assert.equal(parsePositiveInt("TEST_PORT", 80), 3000);
  });

  it("trims surrounding whitespace before parsing", () => {
    process.env.TEST_PORT = "  4000  ";
    assert.equal(parsePositiveInt("TEST_PORT", 80), 4000);
  });

  it("rejects trailing non-numeric characters", () => {
    process.env.TEST_PORT = "3000abc";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });

  it("rejects zero", () => {
    process.env.TEST_PORT = "0";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });

  it("rejects negative numbers", () => {
    process.env.TEST_PORT = "-1";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });

  it("rejects floating-point values", () => {
    process.env.TEST_PORT = "3.14";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });

  it("rejects whitespace-only values", () => {
    process.env.TEST_PORT = "   ";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });
});

describe("loadConfig", () => {
  const CONFIG_ENV_VARS = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "API_KEY",
    "PORT",
    "HOST",
    "MAX_UPLOAD_BYTES",
    "MAX_FILE_COUNT",
    "MAX_SINGLE_FILE_BYTES",
    "MAX_MULTIPART_FIELDS",
    "MAX_MULTIPART_FIELD_SIZE",
  ];
  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of CONFIG_ENV_VARS) {
      originals[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of CONFIG_ENV_VARS) {
      if (originals[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originals[key];
      }
    }
  });

  it("loads config with required env vars set", () => {
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    process.env.API_KEY = "test-api-key";
    const config = loadConfig();
    assert.equal(config.cloudflareApiToken, "test-token");
    assert.equal(config.cloudflareAccountId, "test-account");
    assert.equal(config.apiKey, "test-api-key");
    assert.equal(config.port, 3000);
    assert.equal(config.host, "0.0.0.0");
    assert.equal(config.maxFileCount, 1000);
  });

  it("throws when CLOUDFLARE_API_TOKEN is missing", () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    process.env.API_KEY = "test-api-key";
    assert.throws(() => loadConfig(), /Missing CLOUDFLARE_API_TOKEN/);
  });

  it("throws when CLOUDFLARE_ACCOUNT_ID is missing", () => {
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    process.env.API_KEY = "test-api-key";
    assert.throws(() => loadConfig(), /Missing CLOUDFLARE_ACCOUNT_ID/);
  });

  it("throws when API_KEY is missing", () => {
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    delete process.env.API_KEY;
    assert.throws(() => loadConfig(), /Missing API_KEY/);
  });

  it("computes bodyLimitBytes as sum of upload and field limits", () => {
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    process.env.API_KEY = "test-api-key";
    const config = loadConfig();
    const expectedParts = config.maxFileCount + config.maxMultipartFields + 2;
    assert.equal(config.maxMultipartParts, expectedParts);
    assert.equal(
      config.bodyLimitBytes,
      config.maxUploadBytes + config.maxMultipartParts * config.maxMultipartFieldSize,
    );
  });
});
