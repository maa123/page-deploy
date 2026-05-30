import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isForbiddenRelativePath } from "./forbidden-paths.js";

describe("isForbiddenRelativePath", () => {
  it("rejects worker and functions paths", () => {
    assert.equal(isForbiddenRelativePath("_worker.js"), true);
    assert.equal(isForbiddenRelativePath("_worker.bundle"), true);
    assert.equal(isForbiddenRelativePath("functions/api.ts"), true);
    assert.equal(isForbiddenRelativePath("functions"), true);
    assert.equal(isForbiddenRelativePath("_routes.json"), true);
  });

  it("allows headers and redirects", () => {
    assert.equal(isForbiddenRelativePath("_headers"), false);
    assert.equal(isForbiddenRelativePath("_redirects"), false);
    assert.equal(isForbiddenRelativePath("index.html"), false);
  });
});
