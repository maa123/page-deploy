import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseApiKeyPublicRow,
  parseApiKeyRow,
  parseCount,
  parseProjectRow,
} from "./sqlite-values.js";

describe("parseProjectRow", () => {
  it("parses a valid project row", () => {
    const row = parseProjectRow({
      id: "uuid",
      slug: "my-site",
      cf_account_id: "acct",
      cf_project_name: "pages",
      production_branch: null,
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    assert.deepEqual(row, {
      id: "uuid",
      slug: "my-site",
      cf_account_id: "acct",
      cf_project_name: "pages",
      production_branch: null,
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns undefined for invalid row", () => {
    assert.equal(parseProjectRow({ id: 1 }), undefined);
    assert.equal(parseProjectRow(null), undefined);
  });
});

describe("parseApiKeyRow", () => {
  it("parses integer columns from bigint", () => {
    const row = parseApiKeyRow({
      id: "k1",
      project_id: "p1",
      key_id: "kid",
      secret_hash: "hash",
      name: null,
      permissions: "[]",
      allowed_branches: null,
      max_upload_bytes: 1000n,
      max_file_count: null,
      allowed_ip_cidrs: null,
      expires_at: null,
      revoked_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(row?.max_upload_bytes, 1000);
  });
});

describe("parseApiKeyPublicRow", () => {
  it("parses without secret_hash column", () => {
    const row = parseApiKeyPublicRow({
      id: "k1",
      project_id: "p1",
      key_id: "kid",
      name: "ci",
      permissions: "[]",
      allowed_branches: null,
      max_upload_bytes: null,
      max_file_count: 5,
      allowed_ip_cidrs: null,
      expires_at: null,
      revoked_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(row?.max_file_count, 5);
  });
});

describe("parseCount", () => {
  it("parses count as number", () => {
    assert.equal(parseCount({ count: 3 }), 3);
  });

  it("parses count from bigint", () => {
    assert.equal(parseCount({ count: 2n }), 2);
  });
});
