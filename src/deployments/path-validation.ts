import path from "node:path";

const WINDOWS_RESERVED = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

export function isWindowsReservedPathSegment(segment: string): boolean {
  const upper = segment.toUpperCase();
  const stem = upper.includes(".") ? upper.slice(0, upper.indexOf(".")) : upper;
  const normalized = stem.replace(/\.+$/, "");
  return WINDOWS_RESERVED.has(normalized);
}

export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathValidationError";
  }
}

export function normalizeRelativePath(filename: string): string {
  if (!filename || filename.trim() === "") {
    throw new PathValidationError("filename is required");
  }

  if (filename.includes("\0")) {
    throw new PathValidationError("filename contains null byte");
  }

  let normalized = filename.replace(/\\/g, "/");

  if (/^[a-zA-Z]:/.test(normalized)) {
    throw new PathValidationError("absolute paths are not allowed");
  }

  if (normalized.startsWith("/")) {
    throw new PathValidationError("absolute paths are not allowed");
  }

  normalized = normalized.replace(/^\/+/, "");
  normalized = path.posix.normalize(normalized);

  if (normalized === "." || normalized === "") {
    throw new PathValidationError("filename resolves to empty path");
  }

  if (normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
    throw new PathValidationError("path traversal is not allowed");
  }

  const segments = normalized.split("/");
  for (const segment of segments) {
    if (segment === "..") {
      throw new PathValidationError("path traversal is not allowed");
    }
    if (segment === "") {
      throw new PathValidationError("empty path segment is not allowed");
    }
    if (isWindowsReservedPathSegment(segment)) {
      throw new PathValidationError(`reserved path segment: ${segment}`);
    }
  }

  return normalized;
}

export function assertPathWithinRoot(rootDir: string, relativePath: string): void {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(rootDir, relativePath);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PathValidationError("path escapes asset root");
  }
}
