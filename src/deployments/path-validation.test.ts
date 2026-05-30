import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isWindowsReservedPathSegment,
  normalizeRelativePath,
  PathValidationError,
} from "./path-validation.js";

describe("normalizeRelativePath", () => {
  it("normalizes nested paths", () => {
    assert.equal(normalizeRelativePath("assets\\app.js"), "assets/app.js");
    assert.equal(normalizeRelativePath("./index.html"), "index.html");
  });

  it("rejects reserved Windows device names with extensions", () => {
    assert.throws(() => normalizeRelativePath("CON.txt"), PathValidationError);
    assert.throws(() => normalizeRelativePath("assets/COM1.js"), PathValidationError);
    assert.equal(isWindowsReservedPathSegment("CON.txt"), true);
    assert.equal(isWindowsReservedPathSegment("index.html"), false);
  });

  it("rejects traversal and absolute paths", () => {
    assert.throws(() => normalizeRelativePath("../secret.txt"), PathValidationError);
    assert.throws(() => normalizeRelativePath("/etc/passwd"), PathValidationError);
    assert.throws(() => normalizeRelativePath("C:\\windows\\system32"), PathValidationError);
    assert.throws(() => normalizeRelativePath(""), PathValidationError);
  });
});
