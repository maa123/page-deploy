import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactSecrets } from "./redact-secrets.js";

describe("redactSecrets", () => {
  it("redacts CLOUDFLARE_API_TOKEN value", () => {
    const input = "CLOUDFLARE_API_TOKEN=supersecret123 something else";
    const result = redactSecrets(input);
    assert.equal(result, "CLOUDFLARE_API_TOKEN=[redacted] something else");
  });

  it("redacts multiple occurrences", () => {
    const input =
      "CLOUDFLARE_API_TOKEN=first and CLOUDFLARE_API_TOKEN=second";
    const result = redactSecrets(input);
    assert.equal(
      result,
      "CLOUDFLARE_API_TOKEN=[redacted] and CLOUDFLARE_API_TOKEN=[redacted]",
    );
  });

  it("does not modify strings without the token", () => {
    const input = "no secrets here";
    assert.equal(redactSecrets(input), input);
  });

  it("returns empty string unchanged", () => {
    assert.equal(redactSecrets(""), "");
  });
});
