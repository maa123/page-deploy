import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { hashSecret } from "./api-key.js";
import { authorizeDeploymentCreate, isAuthFailure } from "./authorize.js";
import { PERMISSION_DEPLOYMENT_CREATE } from "./permissions.js";
import { openMemoryDatabase } from "../db/database.js";
import { insertApiKey, revokeApiKey } from "../db/repositories/api-keys.js";
import { insertProject } from "../db/repositories/projects.js";

async function seedProjectWithKey(options?: {
  allowedBranches?: string[];
  revoked?: boolean;
  permissions?: string[];
}) {
  const db = openMemoryDatabase();
  const projectId = randomUUID();
  const keyId = "testkeyid01";
  const secret = "mysecretvalue1234567890ab";
  const secretHash = await hashSecret(secret);

  insertProject(db, {
    id: projectId,
    slug: "my-site",
    cfAccountId: "cf-acct",
    cfProjectName: "my-pages-site",
    createdAt: new Date().toISOString(),
  });

  const apiKeyRowId = randomUUID();
  insertApiKey(db, {
    id: apiKeyRowId,
    projectId,
    keyId,
    secretHash,
    permissions: options?.permissions ?? [PERMISSION_DEPLOYMENT_CREATE],
    allowedBranches: options?.allowedBranches,
    createdAt: new Date().toISOString(),
  });

  if (options?.revoked) {
    revokeApiKey(db, apiKeyRowId, new Date().toISOString());
  }

  return {
    db,
    projectId,
    bearer: `Bearer dep_live_${keyId}_${secret}`,
    branch: "main",
  };
}

describe("authorizeDeploymentCreate", () => {
  it("returns auth context for valid key", async () => {
    const { db, projectId, bearer, branch } = await seedProjectWithKey();
    const result = await authorizeDeploymentCreate({
      db,
      authorizationHeader: bearer,
      routeProjectId: projectId,
      branch,
      clientIp: "127.0.0.1",
      globalLimits: {
        maxUploadBytes: 1000,
        maxFileCount: 10,
        maxSingleFileBytes: 500,
      },
    });
    assert.equal(isAuthFailure(result), false);
    if (!isAuthFailure(result)) {
      assert.equal(result.cfProjectName, "my-pages-site");
      assert.equal(result.cfAccountId, "cf-acct");
    }
  });

  it("returns 401 for invalid bearer", async () => {
    const { db, projectId, branch } = await seedProjectWithKey();
    const result = await authorizeDeploymentCreate({
      db,
      authorizationHeader: "Bearer invalid",
      routeProjectId: projectId,
      branch,
      clientIp: "127.0.0.1",
      globalLimits: {
        maxUploadBytes: 1000,
        maxFileCount: 10,
        maxSingleFileBytes: 500,
      },
    });
    assert.equal(isAuthFailure(result), true);
    if (isAuthFailure(result)) {
      assert.equal(result.statusCode, 401);
    }
  });

  it("returns 403 for project mismatch", async () => {
    const { db, bearer, branch } = await seedProjectWithKey();
    const result = await authorizeDeploymentCreate({
      db,
      authorizationHeader: bearer,
      routeProjectId: randomUUID(),
      branch,
      clientIp: "127.0.0.1",
      globalLimits: {
        maxUploadBytes: 1000,
        maxFileCount: 10,
        maxSingleFileBytes: 500,
      },
    });
    assert.equal(isAuthFailure(result), true);
    if (isAuthFailure(result)) {
      assert.equal(result.statusCode, 403);
    }
  });

  it("returns 403 for disallowed branch", async () => {
    const { db, projectId, bearer } = await seedProjectWithKey({
      allowedBranches: ["staging"],
    });
    const result = await authorizeDeploymentCreate({
      db,
      authorizationHeader: bearer,
      routeProjectId: projectId,
      branch: "main",
      clientIp: "127.0.0.1",
      globalLimits: {
        maxUploadBytes: 1000,
        maxFileCount: 10,
        maxSingleFileBytes: 500,
      },
    });
    assert.equal(isAuthFailure(result), true);
    if (isAuthFailure(result)) {
      assert.equal(result.statusCode, 403);
    }
  });

  it("returns 401 for revoked key", async () => {
    const { db, projectId, bearer, branch } = await seedProjectWithKey({ revoked: true });
    const result = await authorizeDeploymentCreate({
      db,
      authorizationHeader: bearer,
      routeProjectId: projectId,
      branch,
      clientIp: "127.0.0.1",
      globalLimits: {
        maxUploadBytes: 1000,
        maxFileCount: 10,
        maxSingleFileBytes: 500,
      },
    });
    assert.equal(isAuthFailure(result), true);
    if (isAuthFailure(result)) {
      assert.equal(result.statusCode, 401);
    }
  });

  it("returns 403 when allowed_branches JSON is malformed", async () => {
    const { db, projectId, bearer, branch } = await seedProjectWithKey();
    db.prepare(`UPDATE api_keys SET allowed_branches = ? WHERE key_id = ?`).run(
      "not-valid-json",
      "testkeyid01",
    );
    const result = await authorizeDeploymentCreate({
      db,
      authorizationHeader: bearer,
      routeProjectId: projectId,
      branch,
      clientIp: "127.0.0.1",
      globalLimits: {
        maxUploadBytes: 1000,
        maxFileCount: 10,
        maxSingleFileBytes: 500,
      },
    });
    assert.equal(isAuthFailure(result), true);
    if (isAuthFailure(result)) {
      assert.equal(result.statusCode, 403);
    }
  });

  it("returns 403 when allowed_ip_cidrs JSON is malformed", async () => {
    const { db, projectId, bearer, branch } = await seedProjectWithKey();
    db.prepare(`UPDATE api_keys SET allowed_ip_cidrs = ? WHERE key_id = ?`).run(
      "[broken",
      "testkeyid01",
    );
    const result = await authorizeDeploymentCreate({
      db,
      authorizationHeader: bearer,
      routeProjectId: projectId,
      branch,
      clientIp: "127.0.0.1",
      globalLimits: {
        maxUploadBytes: 1000,
        maxFileCount: 10,
        maxSingleFileBytes: 500,
      },
    });
    assert.equal(isAuthFailure(result), true);
    if (isAuthFailure(result)) {
      assert.equal(result.statusCode, 403);
    }
  });

  it("returns 403 when permissions JSON is malformed", async () => {
    const { db, projectId, bearer, branch } = await seedProjectWithKey();
    db.prepare(`UPDATE api_keys SET permissions = ? WHERE key_id = ?`).run(
      "{bad",
      "testkeyid01",
    );
    const result = await authorizeDeploymentCreate({
      db,
      authorizationHeader: bearer,
      routeProjectId: projectId,
      branch,
      clientIp: "127.0.0.1",
      globalLimits: {
        maxUploadBytes: 1000,
        maxFileCount: 10,
        maxSingleFileBytes: 500,
      },
    });
    assert.equal(isAuthFailure(result), true);
    if (isAuthFailure(result)) {
      assert.equal(result.statusCode, 403);
    }
  });
});
