import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

import { assertValidProjectUuid } from "../auth/project-id.js";
import type { AppConfig } from "../config.js";
import { DeploymentRequestError } from "./deployment-errors.js";
import { handleDeployment } from "./deployment-service.js";

function getFastifyErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code: string }).code;
  }
  return undefined;
}

function isMultipartLimitError(error: unknown): boolean {
  const code = getFastifyErrorCode(error);
  return (
    code === "FST_REQ_FILE_TOO_LARGE" ||
    code === "FST_FILES_LIMIT" ||
    code === "FST_PARTS_LIMIT" ||
    code === "FST_FIELDS_LIMIT"
  );
}

function isInvalidMultipartContentType(error: unknown): boolean {
  return getFastifyErrorCode(error) === "FST_INVALID_MULTIPART_CONTENT_TYPE";
}

function multipartLimitMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: string }).code;
    if (code === "FST_REQ_FILE_TOO_LARGE") {
      return "file exceeds maximum size";
    }
    if (code === "FST_FILES_LIMIT") {
      return "upload exceeds maximum file count";
    }
    if (code === "FST_PARTS_LIMIT") {
      return "upload exceeds maximum part count";
    }
    if (code === "FST_FIELDS_LIMIT") {
      return "upload exceeds maximum field count";
    }
  }
  return "upload limit exceeded";
}

export interface DeploymentRouteDeps {
  config: AppConfig;
  db: DatabaseSync;
}

export async function registerDeploymentRoutes(
  app: FastifyInstance,
  deps: DeploymentRouteDeps,
): Promise<void> {
  const { config, db } = deps;

  app.post<{ Params: { projectId: string } }>(
    "/v1/projects/:projectId/deployments",
    async (request, reply) => {
      const projectId = request.params.projectId;

      try {
        assertValidProjectUuid(projectId);
      } catch (error) {
        if (error instanceof DeploymentRequestError) {
          return reply.code(error.statusCode).send({
            status: "failed",
            projectId,
            errorMessage: error.message,
          });
        }
        throw error;
      }

      try {
        const result = await handleDeployment(request, config, db);
        const statusCode = result.httpStatus ?? (result.status === "success" ? 200 : 502);
        return reply.code(statusCode).send({
          status: result.status,
          projectId: result.projectId,
          branch: result.branch,
          previewUrl: result.previewUrl,
          fileCount: result.fileCount,
          totalBytes: result.totalBytes,
          errorMessage: result.errorMessage,
        });
      } catch (error) {
        if (error instanceof DeploymentRequestError) {
          return reply.code(error.statusCode).send({
            status: "failed",
            projectId: request.params.projectId,
            errorMessage: error.message,
          });
        }
        if (isInvalidMultipartContentType(error)) {
          return reply.code(415).send({
            status: "failed",
            projectId: request.params.projectId,
            errorMessage: "Content-Type must be multipart/form-data",
          });
        }
        if (isMultipartLimitError(error)) {
          return reply.code(400).send({
            status: "failed",
            projectId: request.params.projectId,
            errorMessage: multipartLimitMessage(error),
          });
        }
        request.log.error(error);
        return reply.code(500).send({
          status: "failed",
          projectId: request.params.projectId,
          errorMessage: "internal server error",
        });
      }
    },
  );
}
