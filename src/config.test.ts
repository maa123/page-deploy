import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { parsePositiveInt } from "./config.js";

describe("parsePositiveInt", () => {
  const original = process.env.TEST_PORT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TEST_PORT;
    } else {
      process.env.TEST_PORT = original;
    }
  });

  it("rejects trailing non-numeric characters", () => {
    process.env.TEST_PORT = "3000abc";
    assert.throws(
      () => parsePositiveInt("TEST_PORT", 3000),
      /must be a positive integer/,
    );
  });

  it("accepts valid integers", () => {
    process.env.TEST_PORT = "3000";
    assert.equal(parsePositiveInt("TEST_PORT", 80), 3000);
  });
});
