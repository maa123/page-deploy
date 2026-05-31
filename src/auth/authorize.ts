import type { DatabaseSync } from "node:sqlite";

import type { AppConfig } from "../config.js";
import {
  parseOptionalJsonStringArray,
  parseRequiredJsonStringArray,
} from "../db/json-columns.js";
import { findApiKeyByKeyId } from "../db/repositories/api-keys.js";
import { findProjectById } from "../db/repositories/projects.js";
import { parseBearerAuthorization, verifySecret } from "./api-key.js";
import { isIpAllowed } from "./ip-cidr.js";
import { hasPermission, PERMISSION_DEPLOYMENT_CREATE } from "./permissions.js";

export interface AuthContext {
  apiKeyId: string;
  projectId: string;
  cfAccountId: string;
  cfProjectName: string;
  permissions: string[];
  limits: {
    maxUploadBytes: number;
    maxFileCount: number;
    maxSingleFileBytes: number;
  };
}

/** branch 検証前に確定する認証情報（ファイル受信前に検証） */
export interface PreAuthContext {
  apiKeyId: string;
  projectId: string;
  cfAccountId: string;
  cfProjectName: string;
  permissions: string[];
  limits: AuthContext["limits"];
  allowedBranches: string[] | null;
}

export interface AuthFailure {
  ok: false;
  statusCode: 401 | 403;
  message: string;
}

export type AuthorizeResult = AuthContext | AuthFailure;
export type PreAuthorizeResult = PreAuthContext | AuthFailure;

export function isAuthFailure(
  result: AuthorizeResult | PreAuthorizeResult,
): result is AuthFailure {
  return "ok" in result && result.ok === false;
}

/** 不正な日時は失効扱い（fail-closed） */
export function isApiKeyExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }
  const timestamp = Date.parse(expiresAt);
  if (Number.isNaN(timestamp)) {
    return true;
  }
  return timestamp <= Date.now();
}

function isBranchAllowed(branch: string, allowedBranches: string[] | null): boolean {
  if (allowedBranches === null) {
    return true;
  }
  return allowedBranches.includes(branch);
}

export async function preauthorizeDeploymentCreate(input: {
  db: DatabaseSync;
  authorizationHeader: string | undefined;
  routeProjectId: string;
  clientIp: string;
  globalLimits: Pick<
    AppConfig,
    "maxUploadBytes" | "maxFileCount" | "maxSingleFileBytes"
  >;
}): Promise<PreAuthorizeResult> {
  const parsed = parseBearerAuthorization(input.authorizationHeader);
  if (!parsed) {
    return { ok: false, statusCode: 401, message: "unauthorized" };
  }

  const apiKey = findApiKeyByKeyId(input.db, parsed.keyId);
  if (!apiKey || apiKey.revoked_at || isApiKeyExpired(apiKey.expires_at)) {
    return { ok: false, statusCode: 401, message: "unauthorized" };
  }

  const secretValid = await verifySecret(apiKey.secret_hash, parsed.secret);
  if (!secretValid) {
    return { ok: false, statusCode: 401, message: "unauthorized" };
  }

  if (apiKey.project_id !== input.routeProjectId) {
    return { ok: false, statusCode: 403, message: "forbidden" };
  }

  const permissions = parseRequiredJsonStringArray(apiKey.permissions);
  if (!permissions || !hasPermission(permissions, PERMISSION_DEPLOYMENT_CREATE)) {
    return { ok: false, statusCode: 403, message: "forbidden" };
  }

  const allowedBranches = parseOptionalJsonStringArray(apiKey.allowed_branches);
  if (allowedBranches === undefined) {
    return { ok: false, statusCode: 403, message: "forbidden" };
  }

  const allowedIpCidrs = parseOptionalJsonStringArray(apiKey.allowed_ip_cidrs);
  if (allowedIpCidrs === undefined) {
    return { ok: false, statusCode: 403, message: "forbidden" };
  }
  if (allowedIpCidrs !== null && !isIpAllowed(input.clientIp, allowedIpCidrs)) {
    return { ok: false, statusCode: 403, message: "forbidden" };
  }

  const project = findProjectById(input.db, apiKey.project_id);
  if (!project || project.status !== "active") {
    return { ok: false, statusCode: 403, message: "forbidden" };
  }

  return {
    apiKeyId: apiKey.id,
    projectId: project.id,
    cfAccountId: project.cf_account_id,
    cfProjectName: project.cf_project_name,
    permissions,
    allowedBranches,
    limits: {
      maxUploadBytes: apiKey.max_upload_bytes ?? input.globalLimits.maxUploadBytes,
      maxFileCount: apiKey.max_file_count ?? input.globalLimits.maxFileCount,
      maxSingleFileBytes: input.globalLimits.maxSingleFileBytes,
    },
  };
}

export function authorizeDeploymentBranch(
  preAuth: PreAuthContext,
  branch: string,
): AuthorizeResult {
  if (!isBranchAllowed(branch, preAuth.allowedBranches)) {
    return { ok: false, statusCode: 403, message: "forbidden" };
  }

  return {
    apiKeyId: preAuth.apiKeyId,
    projectId: preAuth.projectId,
    cfAccountId: preAuth.cfAccountId,
    cfProjectName: preAuth.cfProjectName,
    permissions: preAuth.permissions,
    limits: preAuth.limits,
  };
}

export async function authorizeDeploymentCreate(input: {
  db: DatabaseSync;
  authorizationHeader: string | undefined;
  routeProjectId: string;
  branch: string;
  clientIp: string;
  globalLimits: Pick<
    AppConfig,
    "maxUploadBytes" | "maxFileCount" | "maxSingleFileBytes"
  >;
}): Promise<AuthorizeResult> {
  const preAuth = await preauthorizeDeploymentCreate(input);
  if (isAuthFailure(preAuth)) {
    return preAuth;
  }
  return authorizeDeploymentBranch(preAuth, input.branch);
}

export function getBearerFromRequest(headers: {
  authorization?: string | string[];
}): string | undefined {
  const header = headers.authorization;
  if (typeof header === "string") {
    return header.split(",", 1)[0]?.trim();
  }
  if (Array.isArray(header)) {
    return header[0]?.trim();
  }
  return undefined;
}
