import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DeploymentRequestError } from "./deployment-errors.js";
import { assertSafeBranch, assertSafeProjectId } from "./safe-arg.js";

describe("assertSafeProjectId", () => {
  it("accepts alphanumeric project ids", () => {
    assert.doesNotThrow(() => assertSafeProjectId("my-pages-site"));
  });

  it("rejects shell metacharacters", () => {
    assert.throws(() => assertSafeProjectId("proj;rm -rf"), DeploymentRequestError);
  });
});

describe("assertSafeBranch", () => {
  it("accepts branch names with slashes", () => {
    assert.doesNotThrow(() => assertSafeBranch("preview/feature"));
  });

  it("rejects shell metacharacters", () => {
    assert.throws(() => assertSafeBranch("main&whoami"), DeploymentRequestError);
  });
});
