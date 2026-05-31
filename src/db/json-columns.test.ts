import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseOptionalJsonStringArray,
  parseRequiredJsonStringArray,
} from "./json-columns.js";

describe("parseOptionalJsonStringArray", () => {
  it("returns null for SQL NULL (unrestricted)", () => {
    assert.equal(parseOptionalJsonStringArray(null), null);
  });

  it("returns array for valid JSON", () => {
    assert.deepEqual(parseOptionalJsonStringArray('["main"]'), ["main"]);
  });

  it("returns undefined for malformed JSON (deny)", () => {
    assert.equal(parseOptionalJsonStringArray("not-json"), undefined);
  });

  it("returns undefined for JSON that is not a string array", () => {
    assert.equal(parseOptionalJsonStringArray('{"a":1}'), undefined);
  });
});

describe("parseRequiredJsonStringArray", () => {
  it("returns array for valid JSON", () => {
    assert.deepEqual(parseRequiredJsonStringArray('["deployment:create"]'), [
      "deployment:create",
    ]);
  });

  it("returns undefined for malformed JSON", () => {
    assert.equal(parseRequiredJsonStringArray("[]bad"), undefined);
  });
});
