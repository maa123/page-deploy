import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { loadConfig, parsePositiveInt, resolveAdminSessionCookieSecure } from "./config.js";

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
    "SESSION_SECRET",
    "SQLITE_PATH",
    "PORT",
    "HOST",
    "ADMIN_HOST",
    "ADMIN_PORT",
    "ADMIN_SESSION_SECURE",
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

  function setRequiredEnv(): void {
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
    process.env.SESSION_SECRET = "x".repeat(32);
  }

  it("必須の環境変数が設定されていれば設定を読み込む", () => {
    setRequiredEnv();
    const config = loadConfig();
    assert.equal(config.cloudflareApiToken, "test-token");
    assert.equal(config.cloudflareAccountId, "test-account");
    assert.equal(config.sqlitePath, "./data/app.db");
    assert.equal(config.port, 3000);
    assert.equal(config.host, "0.0.0.0");
    assert.equal(config.adminPort, 3001);
    assert.equal(config.maxFileCount, 1000);
  });

  it("CLOUDFLARE_API_TOKEN が未設定のとき例外を投げる", () => {
    setRequiredEnv();
    delete process.env.CLOUDFLARE_API_TOKEN;
    assert.throws(() => loadConfig(), /Missing CLOUDFLARE_API_TOKEN/);
  });

  it("CLOUDFLARE_ACCOUNT_ID が未設定のとき例外を投げる", () => {
    setRequiredEnv();
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    assert.throws(() => loadConfig(), /Missing CLOUDFLARE_ACCOUNT_ID/);
  });

  it("SESSION_SECRET が未設定のとき例外を投げる", () => {
    setRequiredEnv();
    delete process.env.SESSION_SECRET;
    assert.throws(() => loadConfig(), /Missing SESSION_SECRET/);
  });

  it("SESSION_SECRET が 32 文字未満のとき例外を投げる", () => {
    setRequiredEnv();
    process.env.SESSION_SECRET = "short";
    assert.throws(() => loadConfig(), /SESSION_SECRET must be at least 32/);
  });

  it("ADMIN_SESSION_SECURE 未設定時はループバック以外で Secure を有効にする", () => {
    assert.equal(resolveAdminSessionCookieSecure("127.0.0.1"), false);
    assert.equal(resolveAdminSessionCookieSecure("0.0.0.0"), true);
  });

  it("bodyLimitBytes をアップロード上限とフィールド上限の合計として計算する", () => {
    setRequiredEnv();
    const config = loadConfig();
    const expectedParts = config.maxFileCount + config.maxMultipartFields + 2;
    assert.equal(config.maxMultipartParts, expectedParts);
    assert.equal(
      config.bodyLimitBytes,
      config.maxUploadBytes + config.maxMultipartParts * config.maxMultipartFieldSize,
    );
  });
});
