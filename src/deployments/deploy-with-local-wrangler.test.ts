import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractPreviewUrl,
  formatWranglerFailure,
} from "./deploy-with-local-wrangler.js";

describe("extractPreviewUrl", () => {
  it("returns a pages.dev URL when present in stdout", () => {
    const stdout =
      "Deploying...\nSuccess! Preview URL: https://abc123.my-site.pages.dev\nDone.";
    assert.equal(extractPreviewUrl(stdout), "https://abc123.my-site.pages.dev");
  });

  it("returns the first pages.dev URL when multiple are present", () => {
    const stdout =
      "https://first.pages.dev then https://second.pages.dev";
    assert.equal(extractPreviewUrl(stdout), "https://first.pages.dev");
  });

  it("returns undefined when no pages.dev URL is present", () => {
    assert.equal(extractPreviewUrl("Deploy failed."), undefined);
    assert.equal(extractPreviewUrl(""), undefined);
  });
});

describe("formatWranglerFailure", () => {
  it("returns trimmed stderr when stderr is non-empty", () => {
    const result = formatWranglerFailure("  stdout  ", "  some error  ");
    assert.equal(result, "some error");
  });

  it("falls back to stdout when stderr is empty", () => {
    const result = formatWranglerFailure("stdout message", "");
    assert.equal(result, "stdout message");
  });

  it("returns fallback message when both stdout and stderr are empty", () => {
    const result = formatWranglerFailure("", "");
    assert.equal(result, "wrangler deploy failed");
  });

  it("redacts CLOUDFLARE_API_TOKEN in stderr", () => {
    const result = formatWranglerFailure(
      "",
      "error: CLOUDFLARE_API_TOKEN=supersecret failed",
    );
    assert.match(result, /CLOUDFLARE_API_TOKEN=\[redacted\]/);
    assert.doesNotMatch(result, /supersecret/);
  });

  it("redacts CLOUDFLARE_API_TOKEN in stdout when stderr is absent", () => {
    const result = formatWranglerFailure(
      "CLOUDFLARE_API_TOKEN=mysecret caused a problem",
      "",
    );
    assert.match(result, /CLOUDFLARE_API_TOKEN=\[redacted\]/);
    assert.doesNotMatch(result, /mysecret/);
  });
});
