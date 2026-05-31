import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyRequest } from "fastify";

import { parseBearerAuthorization } from "../auth/api-key.js";
import {
  authorizeDeploymentBranch,
  getBearerFromRequest,
  isAuthFailure,
  preauthorizeDeploymentCreate,
  type AuthContext,
} from "../auth/authorize.js";
import type { AppConfig } from "../config.js";
import {
  deployWithLocalWrangler,
  extractPreviewUrl,
  formatWranglerFailure,
} from "./deploy-with-local-wrangler.js";
import { DeploymentRequestError } from "./deployment-errors.js";
import { MaterializeError, createMaterializeState, materializeFile } from "./materialize-files.js";
import { assertSafeBranch, assertSafeProjectId as assertSafeCfProjectName } from "./safe-arg.js";

const ALLOWED_FIELD_NAMES = new Set(["branch"]);

export type DeploymentStatus = "success" | "failed";

export interface DeploymentResult {
  status: DeploymentStatus;
  projectId: string;
  branch: string;
  previewUrl?: string;
  fileCount?: number;
  totalBytes?: number;
  errorMessage?: string;
  httpStatus?: number;
}

export { DeploymentRequestError } from "./deployment-errors.js";

function authFailureResult(
  projectId: string,
  branch: string,
  failure: { statusCode: 401 | 403; message: string },
): DeploymentResult {
  return {
    status: "failed",
    projectId,
    branch,
    errorMessage: failure.message,
    httpStatus: failure.statusCode,
  };
}

export async function handleDeployment(
  request: FastifyRequest<{ Params: { projectId: string } }>,
  config: AppConfig,
  db: DatabaseSync,
): Promise<DeploymentResult> {
  const projectId = request.params.projectId;

  const bearerHeader = getBearerFromRequest(request.headers);
  if (!bearerHeader || !parseBearerAuthorization(bearerHeader)) {
    return {
      status: "failed",
      projectId,
      branch: "",
      errorMessage: "unauthorized",
      httpStatus: 401,
    };
  }

  const preAuth = await preauthorizeDeploymentCreate({
    db,
    authorizationHeader: bearerHeader,
    routeProjectId: projectId,
    clientIp: request.ip,
    globalLimits: config,
  });

  if (isAuthFailure(preAuth)) {
    return authFailureResult(projectId, "", preAuth);
  }

  if (!request.isMultipart()) {
    throw new DeploymentRequestError("Content-Type must be multipart/form-data", 415);
  }

  let branch: string | undefined;
  let authContext: AuthContext | undefined;
  let sawFileBeforeBranch = false;
  const assetDir = await fs.mkdtemp(path.join(os.tmpdir(), `page-deploy-${projectId}-`));
  const state = createMaterializeState();

  try {
    const parts = request.parts();

    for await (const part of parts) {
      if (part.type === "field") {
        if (!ALLOWED_FIELD_NAMES.has(part.fieldname)) {
          throw new DeploymentRequestError(`unexpected field: ${part.fieldname}`, 400);
        }
        const raw = part.value;
        const value = typeof raw === "string" ? raw : String(raw);
        if (value.length > config.maxMultipartFieldSize) {
          throw new DeploymentRequestError(`field ${part.fieldname} exceeds maximum size`, 400);
        }
        if (part.fieldname === "branch") {
          if (authContext) {
            throw new DeploymentRequestError("duplicate branch field", 400);
          }
          const trimmed = value.trim();
          if (!trimmed) {
            throw new DeploymentRequestError("branch is required", 400);
          }
          assertSafeBranch(trimmed);
          const branchAuth = authorizeDeploymentBranch(preAuth, trimmed);
          if (isAuthFailure(branchAuth)) {
            return authFailureResult(projectId, trimmed, branchAuth);
          }
          authContext = branchAuth;
          branch = trimmed;
        }
        continue;
      }

      if (part.type !== "file") {
        continue;
      }

      if (part.fieldname !== "file") {
        part.file.resume();
        continue;
      }

      if (!authContext) {
        part.file.resume();
        sawFileBeforeBranch = true;
        continue;
      }

      const filename = part.filename;
      if (!filename) {
        part.file.resume();
        throw new DeploymentRequestError("file part requires filename", 400);
      }

      try {
        await materializeFile({
          rootDir: assetDir,
          filename,
          stream: part.file,
          limits: authContext.limits,
          state,
        });
      } catch (error) {
        if (error instanceof MaterializeError) {
          throw new DeploymentRequestError(error.message, 400);
        }
        throw error;
      }
    }

    if (sawFileBeforeBranch) {
      throw new DeploymentRequestError("branch field must appear before file parts", 400);
    }

    if (!branch?.trim() || !authContext) {
      throw new DeploymentRequestError("branch is required", 400);
    }

    assertSafeCfProjectName(authContext.cfProjectName);

    if (state.fileCount === 0) {
      throw new DeploymentRequestError("at least one file is required", 400);
    }

    const { exitCode, stdout, stderr } = await deployWithLocalWrangler({
      assetDir,
      projectName: authContext.cfProjectName,
      branch,
      accountId: authContext.cfAccountId,
      apiToken: config.cloudflareApiToken,
    });

    if (exitCode !== 0) {
      return {
        status: "failed",
        projectId,
        branch,
        errorMessage: formatWranglerFailure(stdout, stderr),
        httpStatus: 502,
      };
    }

    return {
      status: "success",
      projectId,
      branch,
      previewUrl: extractPreviewUrl(stdout),
      fileCount: state.fileCount,
      totalBytes: state.totalBytes,
      httpStatus: 200,
    };
  } finally {
    await fs.rm(assetDir, { recursive: true, force: true });
  }
}
