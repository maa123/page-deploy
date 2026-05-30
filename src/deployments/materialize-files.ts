import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

import { isForbiddenRelativePath } from "./forbidden-paths.js";
import { assertPathWithinRoot, normalizeRelativePath, PathValidationError } from "./path-validation.js";

export class MaterializeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterializeError";
  }
}

export interface MaterializeLimits {
  maxFileCount: number;
  maxUploadBytes: number;
  maxSingleFileBytes: number;
}

export interface MaterializeState {
  fileCount: number;
  totalBytes: number;
  writtenPaths: Set<string>;
}

const FILESYSTEM_PATH_COLLISION_CODES = new Set(["ENOTDIR", "EISDIR", "EEXIST"]);

export function assertNoPathHierarchyCollision(
  writtenPaths: Set<string>,
  relativePath: string,
): void {
  for (const existing of writtenPaths) {
    if (existing === relativePath) {
      throw new MaterializeError(`duplicate path: ${relativePath}`);
    }
    if (relativePath.startsWith(`${existing}/`) || existing.startsWith(`${relativePath}/`)) {
      throw new MaterializeError(`conflicting path: ${relativePath}`);
    }
  }
}

function toMaterializeFilesystemError(error: unknown, relativePath: string): MaterializeError | null {
  const code = (error as NodeJS.ErrnoException).code;
  if (code && FILESYSTEM_PATH_COLLISION_CODES.has(code)) {
    if (code === "EEXIST") {
      return new MaterializeError(`duplicate path: ${relativePath}`);
    }
    return new MaterializeError(`conflicting path: ${relativePath}`);
  }
  return null;
}

export function createMaterializeState(): MaterializeState {
  return {
    fileCount: 0,
    totalBytes: 0,
    writtenPaths: new Set(),
  };
}

export interface MaterializeFileInput {
  rootDir: string;
  filename: string;
  stream: Readable;
  limits: MaterializeLimits;
  state: MaterializeState;
}

export async function materializeFile(input: MaterializeFileInput): Promise<string> {
  let relativePath: string;
  try {
    relativePath = normalizeRelativePath(input.filename);
    assertPathWithinRoot(input.rootDir, relativePath);
  } catch (error) {
    if (error instanceof PathValidationError) {
      throw new MaterializeError(error.message);
    }
    throw error;
  }

  if (isForbiddenRelativePath(relativePath)) {
    throw new MaterializeError(`forbidden path: ${relativePath}`);
  }

  assertNoPathHierarchyCollision(input.state.writtenPaths, relativePath);

  if (input.state.fileCount >= input.limits.maxFileCount) {
    throw new MaterializeError(`file count exceeds limit of ${input.limits.maxFileCount}`);
  }

  const destPath = path.join(input.rootDir, relativePath);
  try {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
  } catch (error) {
    const mapped = toMaterializeFilesystemError(error, relativePath);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }

  let fileBytes = 0;
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      fileBytes += buffer.length;

      if (fileBytes > input.limits.maxSingleFileBytes) {
        callback(
          new MaterializeError(
            `file ${relativePath} exceeds single file limit of ${input.limits.maxSingleFileBytes} bytes`,
          ),
        );
        return;
      }

      if (input.state.totalBytes + fileBytes > input.limits.maxUploadBytes) {
        callback(
          new MaterializeError(
            `total upload size exceeds limit of ${input.limits.maxUploadBytes} bytes`,
          ),
        );
        return;
      }

      callback(null, buffer);
    },
  });

  const writeStream = createWriteStream(destPath, { flags: "wx" });

  try {
    await pipeline(input.stream, counter, writeStream);
  } catch (error) {
    await fs.rm(destPath, { force: true }).catch(() => undefined);
    if (error instanceof MaterializeError) {
      throw error;
    }
    const mapped = toMaterializeFilesystemError(error, relativePath);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }

  input.state.fileCount += 1;
  input.state.totalBytes += fileBytes;
  input.state.writtenPaths.add(relativePath);

  return relativePath;
}
