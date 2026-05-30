import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";

import type { AppConfig, Environment } from "../config.js";
import { parseEnvironment } from "../config.js";
import {
  deployWithLocalWrangler,
  extractPreviewUrl,
  formatWranglerFailure,
} from "./deploy-with-local-wrangler.js";
import { MaterializeError, createMaterializeState, materializeFile } from "./materialize-files.js";

export type DeploymentStatus = "success" | "failed";

export interface DeploymentResult {
  status: DeploymentStatus;
  projectId: string;
  branch: string;
  environment: Environment;
  previewUrl?: string;
  fileCount?: number;
  totalBytes?: number;
  errorMessage?: string;
}

export class DeploymentRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "DeploymentRequestError";
  }
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
): Promise<DeploymentResult> {
  const projectId = request.params.projectId;
  let branch: string | undefined;
  let environment: Environment | undefined;
  const assetDir = await fs.mkdtemp(path.join(os.tmpdir(), `page-deploy-${projectId}-`));
  const state = createMaterializeState();

  try {
    const parts = request.parts();
    let sawFile = false;

    for await (const part of parts) {
      if (part.type === "field") {
        const value = String(part.value);
        if (part.fieldname === "branch") {
          branch = value;
        } else if (part.fieldname === "environment") {
          try {
            environment = parseEnvironment(value);
          } catch {
            throw new DeploymentRequestError('environment must be "production" or "preview"', 400);
          }
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
    if (!environment) {
      throw new DeploymentRequestError("environment is required", 400);
    }
    if (!sawFile || state.fileCount === 0) {
      throw new DeploymentRequestError("at least one file is required", 400);
    }

    const { exitCode, stdout, stderr } = await deployWithLocalWrangler({
      assetDir,
      projectName: projectId,
      branch: branch.trim(),
      accountId: config.cloudflareAccountId,
      apiToken: config.cloudflareApiToken,
    });

    if (exitCode !== 0) {
      return {
        status: "failed",
        projectId,
        branch: branch.trim(),
        environment,
        errorMessage: formatWranglerFailure(stdout, stderr),
      };
    }

    return {
      status: "success",
      projectId,
      branch: branch.trim(),
      environment,
      previewUrl: extractPreviewUrl(stdout),
      fileCount: state.fileCount,
      totalBytes: state.totalBytes,
    };
  } finally {
    await fs.rm(assetDir, { recursive: true, force: true });
  }
}
