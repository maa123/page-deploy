const FORBIDDEN_BASENAMES = new Set([
  "_worker.js",
  "_worker.bundle",
  "functions-filepath-routing-config.json",
  "_routes.json",
]);

export function isForbiddenRelativePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const basename = normalized.split("/").pop() ?? normalized;

  if (FORBIDDEN_BASENAMES.has(basename)) {
    return true;
  }

  if (normalized === "functions" || normalized.startsWith("functions/")) {
    return true;
  }

  return false;
}
