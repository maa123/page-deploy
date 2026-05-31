import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactSecrets } from "./redact-secrets.js";

describe("シークレットのマスク", () => {
  it("CLOUDFLARE_API_TOKEN の値をマスクする", () => {
    const input = "CLOUDFLARE_API_TOKEN=supersecret123 something else";
    const result = redactSecrets(input);
    assert.equal(result, "CLOUDFLARE_API_TOKEN=[redacted] something else");
  });

  it("複数箇所をマスクする", () => {
    const input =
      "CLOUDFLARE_API_TOKEN=first and CLOUDFLARE_API_TOKEN=second";
    const result = redactSecrets(input);
    assert.equal(
      result,
      "CLOUDFLARE_API_TOKEN=[redacted] and CLOUDFLARE_API_TOKEN=[redacted]",
    );
  });

  it("トークンを含まない文字列は変更しない", () => {
    const input = "no secrets here";
    assert.equal(redactSecrets(input), input);
  });

  it("空文字列はそのまま返す", () => {
    assert.equal(redactSecrets(""), "");
  });
});
