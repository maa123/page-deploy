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

  it("rejects functions-filepath-routing-config.json", () => {
    assert.equal(
      isForbiddenRelativePath("functions-filepath-routing-config.json"),
      true,
    );
  });

  it("rejects forbidden basenames nested inside directories", () => {
    assert.equal(isForbiddenRelativePath("subdir/_worker.js"), true);
    assert.equal(isForbiddenRelativePath("a/b/_routes.json"), true);
    assert.equal(
      isForbiddenRelativePath("deep/nested/functions-filepath-routing-config.json"),
      true,
    );
  });

  it("rejects functions directory with Windows-style backslash separator", () => {
    assert.equal(isForbiddenRelativePath("functions\\api.ts"), true);
  });

  it("rejects paths that start with functions/", () => {
    assert.equal(isForbiddenRelativePath("functions/nested/route.ts"), true);
  });

  it("allows headers and redirects", () => {
    assert.equal(isForbiddenRelativePath("_headers"), false);
    assert.equal(isForbiddenRelativePath("_redirects"), false);
    assert.equal(isForbiddenRelativePath("index.html"), false);
  });

  it("allows paths whose name only starts with 'functions' as a prefix", () => {
    assert.equal(isForbiddenRelativePath("functions-extra/route.ts"), false);
    assert.equal(isForbiddenRelativePath("functionsdata"), false);
  });
});
