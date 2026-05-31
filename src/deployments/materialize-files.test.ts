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

describe("パス階層の衝突チェック", () => {
  it("ファイルとディレクトリのパス衝突を拒否する", () => {
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

  it("新しいパスが既存パスの親のとき拒否する", () => {
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

  it("完全に重複したパスを拒否する", () => {
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

  it("衝突しないパスは許可する", () => {
    const written = new Set(["assets/app.js"]);
    assert.doesNotThrow(() =>
      assertNoPathHierarchyCollision(written, "assets/style.css"),
    );
  });
});

describe("ファイルの書き出し", () => {
  it("ファイルを書き込み状態を更新する", async () => {
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

  it("ネストしたファイルを書き込み中間ディレクトリを作成する", async () => {
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

  it("親パスがすでにファイルのとき衝突するパスを拒否する", async () => {
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

  it("重複パスを拒否する", async () => {
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

  it("ファイル数上限に達したとき拒否する", async () => {
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

  it("単一ファイルサイズ上限を超えるファイルを拒否する", async () => {
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

  it("合計アップロードサイズ上限を超えたとき拒否する", async () => {
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

  it("_worker.js などの禁止パスを拒否する", async () => {
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

  it("パストラバーサルなどの無効なパスを拒否する", async () => {
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
