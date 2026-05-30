import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { describe, it } from "node:test";

import {
  assertNoPathHierarchyCollision,
  createMaterializeState,
  MaterializeError,
  materializeFile,
} from "./materialize-files.js";

describe("assertNoPathHierarchyCollision", () => {
  it("rejects file/directory path collisions", () => {
    const written = new Set(["assets"]);
    assert.throws(
      () => assertNoPathHierarchyCollision(written, "assets/app.js"),
      (error: unknown) => {
        assert.ok(error instanceof MaterializeError);
        assert.match((error as MaterializeError).message, /conflicting path/);
        return true;
      },
    );
  });

  it("rejects when new path is a parent of an existing path", () => {
    const written = new Set(["assets/app.js"]);
    assert.throws(
      () => assertNoPathHierarchyCollision(written, "assets"),
      (error: unknown) => {
        assert.ok(error instanceof MaterializeError);
        assert.match((error as MaterializeError).message, /conflicting path/);
        return true;
      },
    );
  });

  it("rejects an exact duplicate path", () => {
    const written = new Set(["index.html"]);
    assert.throws(
      () => assertNoPathHierarchyCollision(written, "index.html"),
      (error: unknown) => {
        assert.ok(error instanceof MaterializeError);
        assert.match((error as MaterializeError).message, /duplicate path/);
        return true;
      },
    );
  });

  it("allows non-conflicting paths", () => {
    const written = new Set(["assets/app.js"]);
    assert.doesNotThrow(() =>
      assertNoPathHierarchyCollision(written, "assets/style.css"),
    );
  });
});

describe("materializeFile", () => {
  it("writes a file successfully and updates state", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-test-"));
    try {
      const state = createMaterializeState();
      const limits = { maxFileCount: 10, maxUploadBytes: 1024, maxSingleFileBytes: 512 };

      const relativePath = await materializeFile({
        rootDir,
        filename: "index.html",
        stream: Readable.from(["hello"]),
        limits,
        state,
      });

      assert.equal(relativePath, "index.html");
      assert.equal(state.fileCount, 1);
      assert.ok(state.totalBytes > 0);
      assert.ok(state.writtenPaths.has("index.html"));

      const written = await fs.readFile(path.join(rootDir, "index.html"), "utf8");
      assert.equal(written, "hello");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("writes nested files and creates intermediate directories", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-test-"));
    try {
      const state = createMaterializeState();
      const limits = { maxFileCount: 10, maxUploadBytes: 1024, maxSingleFileBytes: 512 };

      const relativePath = await materializeFile({
        rootDir,
        filename: "assets/app.js",
        stream: Readable.from(["console.log('hi')"]),
        limits,
        state,
      });

      assert.equal(relativePath, "assets/app.js");
      const content = await fs.readFile(path.join(rootDir, "assets/app.js"), "utf8");
      assert.equal(content, "console.log('hi')");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects conflicting paths when a parent path is already a file", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-test-"));
    try {
      const state = createMaterializeState();
      const limits = { maxFileCount: 10, maxUploadBytes: 1024, maxSingleFileBytes: 512 };

      await materializeFile({
        rootDir,
        filename: "assets",
        stream: Readable.from(["dir-marker"]),
        limits,
        state,
      });

      await assert.rejects(
        () =>
          materializeFile({
            rootDir,
            filename: "assets/app.js",
            stream: Readable.from(["body"]),
            limits,
            state,
          }),
        (error: unknown) => {
          assert.ok(error instanceof MaterializeError);
          assert.match((error as MaterializeError).message, /conflicting path/);
          return true;
        },
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

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

  it("rejects when file count limit is reached", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-test-"));
    try {
      const limits = { maxFileCount: 1, maxUploadBytes: 1024, maxSingleFileBytes: 512 };
      const state = createMaterializeState();

      await materializeFile({
        rootDir,
        filename: "first.html",
        stream: Readable.from(["a"]),
        limits,
        state,
      });

      await assert.rejects(
        () =>
          materializeFile({
            rootDir,
            filename: "second.html",
            stream: Readable.from(["b"]),
            limits,
            state,
          }),
        (error: unknown) => {
          assert.ok(error instanceof MaterializeError);
          assert.match((error as MaterializeError).message, /file count exceeds limit/);
          return true;
        },
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects a file that exceeds the single-file size limit", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-test-"));
    try {
      const limits = { maxFileCount: 10, maxUploadBytes: 1024, maxSingleFileBytes: 3 };
      const state = createMaterializeState();

      await assert.rejects(
        () =>
          materializeFile({
            rootDir,
            filename: "big.bin",
            stream: Readable.from(["toolarge"]),
            limits,
            state,
          }),
        (error: unknown) => {
          assert.ok(error instanceof MaterializeError);
          assert.match((error as MaterializeError).message, /exceeds single file limit/);
          return true;
        },
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects when total upload size is exceeded", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-test-"));
    try {
      const limits = { maxFileCount: 10, maxUploadBytes: 5, maxSingleFileBytes: 512 };
      const state = createMaterializeState();

      await materializeFile({
        rootDir,
        filename: "first.txt",
        stream: Readable.from(["abcde"]),
        limits,
        state,
      });

      await assert.rejects(
        () =>
          materializeFile({
            rootDir,
            filename: "second.txt",
            stream: Readable.from(["x"]),
            limits,
            state,
          }),
        (error: unknown) => {
          assert.ok(error instanceof MaterializeError);
          assert.match(
            (error as MaterializeError).message,
            /total upload size exceeds limit/,
          );
          return true;
        },
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects forbidden paths such as _worker.js", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-test-"));
    try {
      const state = createMaterializeState();
      const limits = { maxFileCount: 10, maxUploadBytes: 1024, maxSingleFileBytes: 512 };

      await assert.rejects(
        () =>
          materializeFile({
            rootDir,
            filename: "_worker.js",
            stream: Readable.from(["evil"]),
            limits,
            state,
          }),
        (error: unknown) => {
          assert.ok(error instanceof MaterializeError);
          assert.match((error as MaterializeError).message, /forbidden path/);
          return true;
        },
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects invalid paths such as path traversal", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-test-"));
    try {
      const state = createMaterializeState();
      const limits = { maxFileCount: 10, maxUploadBytes: 1024, maxSingleFileBytes: 512 };

      await assert.rejects(
        () =>
          materializeFile({
            rootDir,
            filename: "../outside.txt",
            stream: Readable.from(["evil"]),
            limits,
            state,
          }),
        (error: unknown) => {
          assert.ok(error instanceof MaterializeError);
          return true;
        },
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
