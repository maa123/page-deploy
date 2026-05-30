import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";

import type { AppConfig } from "../config.js";
import {
  deployWithLocalWrangler,
  extractPreviewUrl,
  formatWranglerFailure,
} from "./deploy-with-local-wrangler.js";
import { DeploymentRequestError } from "./deployment-errors.js";
import { MaterializeError, createMaterializeState, materializeFile } from "./materialize-files.js";
import { assertSafeBranch, assertSafeProjectId } from "./safe-arg.js";

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
}

export { DeploymentRequestError } from "./deployment-errors.js";

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
): Promise<DeploymentResult> {
  const projectId = request.params.projectId;
  assertSafeProjectId(projectId);

  if (!request.isMultipart()) {
    throw new DeploymentRequestError("Content-Type must be multipart/form-data", 415);
  }

  let branch: string | undefined;
  const assetDir = await fs.mkdtemp(path.join(os.tmpdir(), `page-deploy-${projectId}-`));
  const state = createMaterializeState();

  try {
    const parts = request.parts();
    let sawFile = false;

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

      sawFile = true;
      try {
        await materializeFile({
          rootDir: assetDir,
          filename,
          stream: part.file,
          limits: {
            maxFileCount: config.maxFileCount,
            maxUploadBytes: config.maxUploadBytes,
            maxSingleFileBytes: config.maxSingleFileBytes,
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

    if (!branch?.trim()) {
      throw new DeploymentRequestError("branch is required", 400);
    }
    const trimmedBranch = branch.trim();
    assertSafeBranch(trimmedBranch);

    if (!sawFile || state.fileCount === 0) {
      throw new DeploymentRequestError("at least one file is required", 400);
    }

    const { exitCode, stdout, stderr } = await deployWithLocalWrangler({
      assetDir,
      projectName: projectId,
      branch: trimmedBranch,
      accountId: config.cloudflareAccountId,
      apiToken: config.cloudflareApiToken,
    });

    if (exitCode !== 0) {
      return {
        status: "failed",
        projectId,
        branch: trimmedBranch,
        errorMessage: formatWranglerFailure(stdout, stderr),
      };
    }

    return {
      status: "success",
      projectId,
      branch: trimmedBranch,
      previewUrl: extractPreviewUrl(stdout),
      fileCount: state.fileCount,
      totalBytes: state.totalBytes,
    };
  } finally {
    await fs.rm(assetDir, { recursive: true, force: true });
  }
}
