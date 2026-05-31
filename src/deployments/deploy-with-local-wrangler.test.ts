import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractPreviewUrl,
  formatWranglerFailure,
} from "./deploy-with-local-wrangler.js";

describe("プレビュー URL の抽出", () => {
  it("stdout に pages.dev URL があるときその URL を返す", () => {
    const stdout =
      "Deploying...\nSuccess! Preview URL: https://abc123.my-site.pages.dev\nDone.";
    assert.equal(extractPreviewUrl(stdout), "https://abc123.my-site.pages.dev");
  });

  it("複数の pages.dev URL があるとき最初の URL を返す", () => {
    const stdout =
      "https://first.pages.dev then https://second.pages.dev";
    assert.equal(extractPreviewUrl(stdout), "https://first.pages.dev");
  });

  it("pages.dev URL がないとき undefined を返す", () => {
    assert.equal(extractPreviewUrl("Deploy failed."), undefined);
    assert.equal(extractPreviewUrl(""), undefined);
  });
});

describe("Wrangler 失敗メッセージの整形", () => {
  it("stderr が空でないときトリムした stderr を返す", () => {
    const result = formatWranglerFailure("  stdout  ", "  some error  ");
    assert.equal(result, "some error");
  });

  it("stderr が空のとき stdout にフォールバックする", () => {
    const result = formatWranglerFailure("stdout message", "");
    assert.equal(result, "stdout message");
  });

  it("stdout と stderr がともに空のときフォールバックメッセージを返す", () => {
    const result = formatWranglerFailure("", "");
    assert.equal(result, "wrangler deploy failed");
  });

  it("stderr 内の CLOUDFLARE_API_TOKEN をマスクする", () => {
    const result = formatWranglerFailure(
      "",
      "error: CLOUDFLARE_API_TOKEN=supersecret failed",
    );
    assert.match(result, /CLOUDFLARE_API_TOKEN=\[redacted\]/);
    assert.doesNotMatch(result, /supersecret/);
  });

  it("stderr がないとき stdout 内の CLOUDFLARE_API_TOKEN をマスクする", () => {
    const result = formatWranglerFailure(
      "CLOUDFLARE_API_TOKEN=mysecret caused a problem",
      "",
    );
    assert.match(result, /CLOUDFLARE_API_TOKEN=\[redacted\]/);
    assert.doesNotMatch(result, /mysecret/);
  });
});
