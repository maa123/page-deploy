import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPathWithinRoot,
  isWindowsReservedPathSegment,
  normalizeRelativePath,
  PathValidationError,
} from "./path-validation.js";

describe("isWindowsReservedPathSegment", () => {
  it("returns true for reserved device names", () => {
    assert.equal(isWindowsReservedPathSegment("CON"), true);
    assert.equal(isWindowsReservedPathSegment("PRN"), true);
    assert.equal(isWindowsReservedPathSegment("AUX"), true);
    assert.equal(isWindowsReservedPathSegment("NUL"), true);
    assert.equal(isWindowsReservedPathSegment("COM1"), true);
    assert.equal(isWindowsReservedPathSegment("LPT9"), true);
  });

  it("is case-insensitive", () => {
    assert.equal(isWindowsReservedPathSegment("con"), true);
    assert.equal(isWindowsReservedPathSegment("Nul"), true);
    assert.equal(isWindowsReservedPathSegment("com1"), true);
  });

  it("returns true for reserved names with extensions", () => {
    assert.equal(isWindowsReservedPathSegment("CON.txt"), true);
    assert.equal(isWindowsReservedPathSegment("NUL.log"), true);
  });

  it("returns false for normal path segments", () => {
    assert.equal(isWindowsReservedPathSegment("index.html"), false);
    assert.equal(isWindowsReservedPathSegment("app.js"), false);
    assert.equal(isWindowsReservedPathSegment("console.log"), false);
  });
});

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

  it("rejects filenames containing null bytes", () => {
    assert.throws(() => normalizeRelativePath("evil\x00file"), PathValidationError);
  });

  it("rejects whitespace-only filenames", () => {
    assert.throws(() => normalizeRelativePath("   "), PathValidationError);
  });

  it("rejects paths that normalize to the current directory", () => {
    assert.throws(() => normalizeRelativePath("."), PathValidationError);
  });

  it("normalizes paths with a leading ./", () => {
    assert.equal(normalizeRelativePath("./assets/style.css"), "assets/style.css");
  });

  it("accepts deeply nested valid paths", () => {
    assert.equal(normalizeRelativePath("a/b/c/index.html"), "a/b/c/index.html");
  });
});

describe("assertPathWithinRoot", () => {
  it("accepts a file directly in the root", () => {
    assert.doesNotThrow(() => assertPathWithinRoot("/tmp/root", "index.html"));
  });

  it("accepts a nested file within the root", () => {
    assert.doesNotThrow(() => assertPathWithinRoot("/tmp/root", "assets/app.js"));
  });

  it("throws for a path that escapes the root via traversal", () => {
    assert.throws(
      () => assertPathWithinRoot("/tmp/root", "../secret.txt"),
      PathValidationError,
    );
  });

  it("throws for an absolute path outside the root", () => {
    assert.throws(
      () => assertPathWithinRoot("/tmp/root", "/etc/passwd"),
      PathValidationError,
    );
  });
});
