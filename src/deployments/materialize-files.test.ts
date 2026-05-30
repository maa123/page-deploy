import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { describe, it } from "node:test";

import {
  createMaterializeState,
  MaterializeError,
  materializeFile,
} from "./materialize-files.js";

describe("materializeFile", () => {
  it("rejects duplicate paths", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-test-"));
    try {
      const state = createMaterializeState();
      const limits = { maxFileCount: 10, maxUploadBytes: 1024, maxSingleFileBytes: 512 };

      await materializeFile({
        rootDir,
        filename: "index.html",
        stream: Readable.from(["hello"]),
        limits,
        state,
      });

      await assert.rejects(
        () =>
          materializeFile({
            rootDir,
            filename: "index.html",
            stream: Readable.from(["again"]),
            limits,
            state,
          }),
        (error: unknown) => {
          assert.ok(error instanceof MaterializeError);
          assert.match((error as MaterializeError).message, /duplicate path/);
          return true;
        },
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
