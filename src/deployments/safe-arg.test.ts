import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DeploymentRequestError } from "./deployment-errors.js";
import { assertSafeBranch, assertSafeProjectId } from "./safe-arg.js";

describe("assertSafeProjectId", () => {
  it("accepts alphanumeric project ids", () => {
    assert.doesNotThrow(() => assertSafeProjectId("my-pages-site"));
  });

  it("accepts ids with underscores and digits", () => {
    assert.doesNotThrow(() => assertSafeProjectId("my_site123"));
    assert.doesNotThrow(() => assertSafeProjectId("a1"));
  });

  it("accepts a single alphanumeric character", () => {
    assert.doesNotThrow(() => assertSafeProjectId("a"));
  });

  it("rejects shell metacharacters", () => {
    assert.throws(() => assertSafeProjectId("proj;rm -rf"), DeploymentRequestError);
    assert.throws(() => assertSafeProjectId("proj$(id)"), DeploymentRequestError);
    assert.throws(() => assertSafeProjectId("proj`id`"), DeploymentRequestError);
  });

  it("rejects an empty string", () => {
    assert.throws(() => assertSafeProjectId(""), DeploymentRequestError);
  });

  it("rejects ids that start with a hyphen", () => {
    assert.throws(() => assertSafeProjectId("-bad"), DeploymentRequestError);
  });

  it("rejects ids that start with an underscore", () => {
    assert.throws(() => assertSafeProjectId("_bad"), DeploymentRequestError);
  });

  it("rejects ids longer than 128 characters", () => {
    const tooLong = "a" + "b".repeat(128); // 129 chars
    assert.throws(() => assertSafeProjectId(tooLong), DeploymentRequestError);
  });
});

describe("assertSafeBranch", () => {
  it("accepts branch names with slashes", () => {
    assert.doesNotThrow(() => assertSafeBranch("preview/feature"));
  });

  it("accepts branch names with dots and underscores", () => {
    assert.doesNotThrow(() => assertSafeBranch("release/1.2.3"));
    assert.doesNotThrow(() => assertSafeBranch("feat/my_feature"));
  });

  it("accepts a single alphanumeric character", () => {
    assert.doesNotThrow(() => assertSafeBranch("m"));
  });

  it("rejects shell metacharacters", () => {
    assert.throws(() => assertSafeBranch("main&whoami"), DeploymentRequestError);
    assert.throws(() => assertSafeBranch("main;ls"), DeploymentRequestError);
  });

  it("rejects an empty string", () => {
    assert.throws(() => assertSafeBranch(""), DeploymentRequestError);
  });

  it("rejects branch names that start with a hyphen", () => {
    assert.throws(() => assertSafeBranch("-bad"), DeploymentRequestError);
  });

  it("rejects branch names longer than 256 characters", () => {
    const tooLong = "a" + "b".repeat(256); // 257 chars
    assert.throws(() => assertSafeBranch(tooLong), DeploymentRequestError);
  });
});
