import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseApiKeyToken,
  parseBearerAuthorization,
  verifySecret,
  hashSecret,
} from "./api-key.js";

describe("parseApiKeyToken", () => {
  it("parses valid dep_live token", () => {
    const parsed = parseApiKeyToken("dep_live_abcd1234_mysecretvalue123456");
    assert.deepEqual(parsed, { keyId: "abcd1234", secret: "mysecretvalue123456" });
  });

  it("rejects wrong prefix", () => {
    assert.equal(parseApiKeyToken("dep_test_abcd1234_mysecretvalue123456"), null);
  });

  it("rejects malformed token", () => {
    assert.equal(parseApiKeyToken("dep_live_short"), null);
  });
});

describe("parseBearerAuthorization", () => {
  it("extracts token from Bearer header", () => {
    const parsed = parseBearerAuthorization(
      "Bearer dep_live_abcd1234_mysecretvalue123456",
    );
    assert.equal(parsed?.keyId, "abcd1234");
  });

  it("returns null for missing header", () => {
    assert.equal(parseBearerAuthorization(undefined), null);
  });
});

describe("hashSecret and verifySecret", () => {
  it("verifies hashed secret", async () => {
    const hash = await hashSecret("mysecretvalue123456");
    assert.equal(await verifySecret(hash, "mysecretvalue123456"), true);
    assert.equal(await verifySecret(hash, "wrongsecretvalue12345"), false);
  });
});
