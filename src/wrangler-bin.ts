import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function resolveLocalWranglerBinary(): string {
  if (process.platform === "win32") {
    return path.join(projectRoot, "node_modules", ".bin", "wrangler.cmd");
  }
  return path.join(projectRoot, "node_modules", ".bin", "wrangler");
}
