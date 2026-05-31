export const PERMISSION_DEPLOYMENT_CREATE = "deployment:create";
export const PERMISSION_DEPLOYMENT_READ = "deployment:read";
export const PERMISSION_DEPLOYMENT_CANCEL = "deployment:cancel";
export const PERMISSION_PROJECT_READ = "project:read";
export const PERMISSION_API_KEY_MANAGE = "apiKey:manage";

export const DEFAULT_DEPLOY_PERMISSIONS = [PERMISSION_DEPLOYMENT_CREATE] as const;

export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes(required);
}
