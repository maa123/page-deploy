import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DeploymentRequestError } from "./deployment-errors.js";
import { assertSafeBranch, assertSafeProjectId } from "./safe-arg.js";

describe("プロジェクト ID の安全検証", () => {
  it("英数字のプロジェクト ID を受け入れる", () => {
    assert.doesNotThrow(() => assertSafeProjectId("my-pages-site"));
  });

  it("アンダースコアと数字を含む ID を受け入れる", () => {
    assert.doesNotThrow(() => assertSafeProjectId("my_site123"));
    assert.doesNotThrow(() => assertSafeProjectId("a1"));
  });

  it("英数字1文字の ID を受け入れる", () => {
    assert.doesNotThrow(() => assertSafeProjectId("a"));
  });

  it("シェルメタ文字を含む ID を拒否する", () => {
    assert.throws(() => assertSafeProjectId("proj;rm -rf"), DeploymentRequestError);
    assert.throws(() => assertSafeProjectId("proj$(id)"), DeploymentRequestError);
    assert.throws(() => assertSafeProjectId("proj`id`"), DeploymentRequestError);
  });

  it("空文字列を拒否する", () => {
    assert.throws(() => assertSafeProjectId(""), DeploymentRequestError);
  });

  it("ハイフンで始まる ID を拒否する", () => {
    assert.throws(() => assertSafeProjectId("-bad"), DeploymentRequestError);
  });

  it("アンダースコアで始まる ID を拒否する", () => {
    assert.throws(() => assertSafeProjectId("_bad"), DeploymentRequestError);
  });

  it("128文字を超える ID を拒否する", () => {
    const tooLong = "a" + "b".repeat(128); // 129 文字
    assert.throws(() => assertSafeProjectId(tooLong), DeploymentRequestError);
  });
});

describe("ブランチ名の安全検証", () => {
  it("スラッシュを含むブランチ名を受け入れる", () => {
    assert.doesNotThrow(() => assertSafeBranch("preview/feature"));
  });

  it("ドットとアンダースコアを含むブランチ名を受け入れる", () => {
    assert.doesNotThrow(() => assertSafeBranch("release/1.2.3"));
    assert.doesNotThrow(() => assertSafeBranch("feat/my_feature"));
  });

  it("英数字1文字のブランチ名を受け入れる", () => {
    assert.doesNotThrow(() => assertSafeBranch("m"));
  });

  it("シェルメタ文字を含むブランチ名を拒否する", () => {
    assert.throws(() => assertSafeBranch("main&whoami"), DeploymentRequestError);
    assert.throws(() => assertSafeBranch("main;ls"), DeploymentRequestError);
  });

  it("空文字列を拒否する", () => {
    assert.throws(() => assertSafeBranch(""), DeploymentRequestError);
  });

  it("ハイフンで始まるブランチ名を拒否する", () => {
    assert.throws(() => assertSafeBranch("-bad"), DeploymentRequestError);
  });

  it("256文字を超えるブランチ名を拒否する", () => {
    const tooLong = "a" + "b".repeat(256); // 257 文字
    assert.throws(() => assertSafeBranch(tooLong), DeploymentRequestError);
  });
});
