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

  if (input.state.writtenPaths.has(relativePath)) {
    throw new MaterializeError(`duplicate path: ${relativePath}`);
  }

  if (input.state.fileCount >= input.limits.maxFileCount) {
    throw new MaterializeError(`file count exceeds limit of ${input.limits.maxFileCount}`);
  }

  const destPath = path.join(input.rootDir, relativePath);
  await fs.mkdir(path.dirname(destPath), { recursive: true });

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
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      throw new MaterializeError(`duplicate path: ${relativePath}`);
    }
    throw error;
  }

  input.state.fileCount += 1;
  input.state.totalBytes += fileBytes;
  input.state.writtenPaths.add(relativePath);

  return relativePath;
}
