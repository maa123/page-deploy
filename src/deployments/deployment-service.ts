import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";

import { parseBearerAuthorization } from "../auth/api-key.js";
import {
  authorizeDeploymentCreate,
  getBearerFromRequest,
  getClientIp,
  type AuthContext,
  type AuthFailure,
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

function isAuthFailure(result: AuthContext | AuthFailure): result is AuthFailure {
  return "ok" in result && result.ok === false;
}

function isMultipartFile(part: unknown): part is MultipartFile {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    (part as MultipartFile).type === "file"
  );
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

  if (!request.isMultipart()) {
    throw new DeploymentRequestError("Content-Type must be multipart/form-data", 415);
  }

  let branch: string | undefined;
  const assetDir = await fs.mkdtemp(path.join(os.tmpdir(), `page-deploy-${projectId}-`));
  const state = createMaterializeState();
  const pendingFiles: Array<{ filename: string; part: MultipartFile }> = [];

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
          branch = value;
        }
        continue;
      }

      if (!isMultipartFile(part)) {
        continue;
      }

      if (part.fieldname !== "file") {
        part.file.resume();
        continue;
      }

      const filename = part.filename;
      if (!filename) {
        part.file.resume();
        throw new DeploymentRequestError("file part requires filename", 400);
      }

      pendingFiles.push({ filename, part });
    }

    if (!branch?.trim()) {
      for (const { part } of pendingFiles) {
        part.file.resume();
      }
      throw new DeploymentRequestError("branch is required", 400);
    }
    const trimmedBranch = branch.trim();
    assertSafeBranch(trimmedBranch);

    const authResult = await authorizeDeploymentCreate({
      db,
      authorizationHeader: getBearerFromRequest(request.headers),
      routeProjectId: projectId,
      branch: trimmedBranch,
      clientIp: getClientIp(request),
      globalLimits: config,
    });

    if (isAuthFailure(authResult)) {
      for (const { part } of pendingFiles) {
        part.file.resume();
      }
      return {
        status: "failed",
        projectId,
        branch: trimmedBranch,
        errorMessage: authResult.message,
        httpStatus: authResult.statusCode,
      };
    }

    const authContext: AuthContext = authResult;
    assertSafeCfProjectName(authContext.cfProjectName);

    const limits = authContext.limits;

    for (const { filename, part } of pendingFiles) {
      try {
        await materializeFile({
          rootDir: assetDir,
          filename,
          stream: part.file,
          limits: {
            maxFileCount: limits.maxFileCount,
            maxUploadBytes: limits.maxUploadBytes,
            maxSingleFileBytes: limits.maxSingleFileBytes,
          },
          state,
        });
      } catch (error) {
        if (error instanceof MaterializeError) {
          throw new DeploymentRequestError(error.message, 400);
        }
        throw error;
      }
    }

    if (pendingFiles.length === 0 || state.fileCount === 0) {
      throw new DeploymentRequestError("at least one file is required", 400);
    }

    const { exitCode, stdout, stderr } = await deployWithLocalWrangler({
      assetDir,
      projectName: authContext.cfProjectName,
      branch: trimmedBranch,
      accountId: authContext.cfAccountId,
      apiToken: config.cloudflareApiToken,
    });

    if (exitCode !== 0) {
      return {
        status: "failed",
        projectId,
        branch: trimmedBranch,
        errorMessage: formatWranglerFailure(stdout, stderr),
        httpStatus: 502,
      };
    }

    return {
      status: "success",
      projectId,
      branch: trimmedBranch,
      previewUrl: extractPreviewUrl(stdout),
      fileCount: state.fileCount,
      totalBytes: state.totalBytes,
      httpStatus: 200,
    };
  } finally {
    await fs.rm(assetDir, { recursive: true, force: true });
  }
}
