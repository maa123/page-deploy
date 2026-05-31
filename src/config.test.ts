import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { loadConfig, parsePositiveInt } from "./config.js";

describe("正の整数のパース", () => {
  const original = process.env.TEST_PORT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TEST_PORT;
    } else {
      process.env.TEST_PORT = original;
    }
  });

  it("環境変数が未設定のときフォールバックを返す", () => {
    delete process.env.TEST_PORT;
    assert.equal(parsePositiveInt("TEST_PORT", 8080), 8080);
  });

  it("環境変数が空文字列のときフォールバックを返す", () => {
    process.env.TEST_PORT = "";
    assert.equal(parsePositiveInt("TEST_PORT", 8080), 8080);
  });

  it("有効な整数を受け入れる", () => {
    process.env.TEST_PORT = "3000";
    assert.equal(parsePositiveInt("TEST_PORT", 80), 3000);
  });

  it("前後の空白をトリムしてからパースする", () => {
    process.env.TEST_PORT = "  4000  ";
    assert.equal(parsePositiveInt("TEST_PORT", 80), 4000);
  });

  it("末尾に非数字文字がある値を拒否する", () => {
    process.env.TEST_PORT = "3000abc";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });

  it("ゼロを拒否する", () => {
    process.env.TEST_PORT = "0";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });

  it("負の数を拒否する", () => {
    process.env.TEST_PORT = "-1";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });

  it("浮動小数点数を拒否する", () => {
    process.env.TEST_PORT = "3.14";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });

  it("空白のみの値を拒否する", () => {
    process.env.TEST_PORT = "   ";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });
});

describe("設定の読み込み", () => {
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

  it("必須の環境変数が設定されていれば設定を読み込む", () => {
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

  it("CLOUDFLARE_API_TOKEN が未設定のとき例外を投げる", () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    process.env.API_KEY = "test-api-key";
    assert.throws(() => loadConfig(), /Missing CLOUDFLARE_API_TOKEN/);
  });

  it("CLOUDFLARE_ACCOUNT_ID が未設定のとき例外を投げる", () => {
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

  it("bodyLimitBytes をアップロード上限とフィールド上限の合計として計算する", () => {
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
