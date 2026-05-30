import { DeploymentRequestError } from "./deployment-errors.js";

/** Cloudflare Pages project names and branch labels passed to wrangler argv (no shell). */
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,127})$/;
const BRANCH_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9_./-]{0,255})$/;

export function assertSafeProjectId(projectId: string): void {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new DeploymentRequestError(
      "projectId contains invalid characters",
      400,
    );
  }
}

export function assertSafeBranch(branch: string): void {
  if (!BRANCH_PATTERN.test(branch)) {
    throw new DeploymentRequestError(
      "branch contains invalid characters",
      400,
    );
  }
}
