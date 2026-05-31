import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { loadTrustProxy } from "./trust-proxy.js";

describe("loadTrustProxy", () => {
  const original = process.env.TRUST_PROXY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = original;
    }
  });

  it("returns false when unset", () => {
    delete process.env.TRUST_PROXY;
    assert.equal(loadTrustProxy(), false);
  });

  it("returns true for true", () => {
    process.env.TRUST_PROXY = "true";
    assert.equal(loadTrustProxy(), true);
  });

  it("returns hop count for positive integer", () => {
    process.env.TRUST_PROXY = "2";
    assert.equal(loadTrustProxy(), 2);
  });

  it("returns CIDR list for comma-separated values", () => {
    process.env.TRUST_PROXY = "10.0.0.0/8, 172.16.0.0/12";
    assert.deepEqual(loadTrustProxy(), ["10.0.0.0/8", "172.16.0.0/12"]);
  });
});
