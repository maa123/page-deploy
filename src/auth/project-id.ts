import { DeploymentRequestError } from "../deployments/deployment-errors.js";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidProjectUuid(projectId: string): boolean {
  return UUID_V4_PATTERN.test(projectId);
}

export function assertValidProjectUuid(projectId: string): void {
  if (!isValidProjectUuid(projectId)) {
    throw new DeploymentRequestError("projectId must be a valid UUID", 400);
  }
}
