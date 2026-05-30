import type { FastifyInstance } from "fastify";

import type { AppConfig } from "../config.js";
import { DeploymentRequestError, handleDeployment } from "./deployment-service.js";

export async function registerDeploymentRoutes(
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> {
  app.post<{ Params: { projectId: string } }>(
    "/v1/projects/:projectId/deployments",
    async (request, reply) => {
      try {
        const result = await handleDeployment(request, config);
        const statusCode = result.status === "success" ? 200 : 502;
        return reply.code(statusCode).send(result);
      } catch (error) {
        if (error instanceof DeploymentRequestError) {
          return reply.code(error.statusCode).send({
            status: "failed",
            projectId: request.params.projectId,
            errorMessage: error.message,
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
