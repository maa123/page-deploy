import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isIpAllowed, isValidAllowedIpCidrEntry } from "./ip-cidr.js";

describe("isValidAllowedIpCidrEntry", () => {
  it("accepts IPv4 address and CIDR", () => {
    assert.equal(isValidAllowedIpCidrEntry("203.0.113.10"), true);
    assert.equal(isValidAllowedIpCidrEntry("10.0.0.0/8"), true);
  });

  it("accepts IPv6 address and CIDR", () => {
    assert.equal(isValidAllowedIpCidrEntry("::1"), true);
    assert.equal(isValidAllowedIpCidrEntry("::1/128"), true);
    assert.equal(isValidAllowedIpCidrEntry("2001:db8::/32"), true);
  });

  it("rejects invalid entries", () => {
    assert.equal(isValidAllowedIpCidrEntry("not-an-ip"), false);
    assert.equal(isValidAllowedIpCidrEntry("10.0.0.0/99"), false);
  });
});

describe("isIpAllowed", () => {
  it("denies all IPs when allow-list is empty", () => {
    assert.equal(isIpAllowed("127.0.0.1", []), false);
  });

  it("matches IPv4 CIDR", () => {
    assert.equal(isIpAllowed("10.1.2.3", ["10.0.0.0/8"]), true);
    assert.equal(isIpAllowed("192.0.2.1", ["10.0.0.0/8"]), false);
  });

  it("matches IPv6 CIDR", () => {
    assert.equal(isIpAllowed("::1", ["::1/128"]), true);
    assert.equal(isIpAllowed("2001:db8::1", ["2001:db8::/32"]), true);
    assert.equal(isIpAllowed("2001:db8::1", ["::1/128"]), false);
  });

  it("matches IPv4-mapped IPv6 client address against IPv4 rules", () => {
    assert.equal(isIpAllowed("::ffff:10.1.2.3", ["10.0.0.0/8"]), true);
  });
});
