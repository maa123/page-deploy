import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPathWithinRoot,
  isWindowsReservedPathSegment,
  normalizeRelativePath,
  PathValidationError,
} from "./path-validation.js";

describe("Windows 予約パスセグメントの判定", () => {
  it("予約デバイス名のとき true を返す", () => {
    assert.equal(isWindowsReservedPathSegment("CON"), true);
    assert.equal(isWindowsReservedPathSegment("PRN"), true);
    assert.equal(isWindowsReservedPathSegment("AUX"), true);
    assert.equal(isWindowsReservedPathSegment("NUL"), true);
    assert.equal(isWindowsReservedPathSegment("COM1"), true);
    assert.equal(isWindowsReservedPathSegment("LPT9"), true);
  });

  it("大文字小文字を区別しない", () => {
    assert.equal(isWindowsReservedPathSegment("con"), true);
    assert.equal(isWindowsReservedPathSegment("Nul"), true);
    assert.equal(isWindowsReservedPathSegment("com1"), true);
  });

  it("拡張子付きの予約名のとき true を返す", () => {
    assert.equal(isWindowsReservedPathSegment("CON.txt"), true);
    assert.equal(isWindowsReservedPathSegment("NUL.log"), true);
  });

  it("通常のパスセグメントのとき false を返す", () => {
    assert.equal(isWindowsReservedPathSegment("index.html"), false);
    assert.equal(isWindowsReservedPathSegment("app.js"), false);
    assert.equal(isWindowsReservedPathSegment("console.log"), false);
  });
});

describe("相対パスの正規化", () => {
  it("ネストしたパスを正規化する", () => {
    assert.equal(normalizeRelativePath("assets\\app.js"), "assets/app.js");
    assert.equal(normalizeRelativePath("./index.html"), "index.html");
  });

  it("拡張子付きの Windows 予約デバイス名を拒否する", () => {
    assert.throws(() => normalizeRelativePath("CON.txt"), PathValidationError);
    assert.throws(() => normalizeRelativePath("assets/COM1.js"), PathValidationError);
    assert.equal(isWindowsReservedPathSegment("CON.txt"), true);
    assert.equal(isWindowsReservedPathSegment("index.html"), false);
  });

  it("トラバーサルと絶対パスを拒否する", () => {
    assert.throws(() => normalizeRelativePath("../secret.txt"), PathValidationError);
    assert.throws(() => normalizeRelativePath("/etc/passwd"), PathValidationError);
    assert.throws(() => normalizeRelativePath("C:\\windows\\system32"), PathValidationError);
    assert.throws(() => normalizeRelativePath(""), PathValidationError);
  });

  it("ヌルバイトを含むファイル名を拒否する", () => {
    assert.throws(() => normalizeRelativePath("evil\x00file"), PathValidationError);
  });

  it("空白のみのファイル名を拒否する", () => {
    assert.throws(() => normalizeRelativePath("   "), PathValidationError);
  });

  it("正規化結果がカレントディレクトリになるパスを拒否する", () => {
    assert.throws(() => normalizeRelativePath("."), PathValidationError);
  });

  it("先頭が ./ のパスを正規化する", () => {
    assert.equal(normalizeRelativePath("./assets/style.css"), "assets/style.css");
  });

  it("深くネストした有効なパスを受け入れる", () => {
    assert.equal(normalizeRelativePath("a/b/c/index.html"), "a/b/c/index.html");
  });
});

describe("ルート内パスの検証", () => {
  it("ルート直下のファイルを受け入れる", () => {
    assert.doesNotThrow(() => assertPathWithinRoot("/tmp/root", "index.html"));
  });

  it("ルート内にネストしたファイルを受け入れる", () => {
    assert.doesNotThrow(() => assertPathWithinRoot("/tmp/root", "assets/app.js"));
  });

  it("トラバーサルでルート外に出るパスで例外を投げる", () => {
    assert.throws(
      () => assertPathWithinRoot("/tmp/root", "../secret.txt"),
      PathValidationError,
    );
  });

  it("ルート外の絶対パスで例外を投げる", () => {
    assert.throws(
      () => assertPathWithinRoot("/tmp/root", "/etc/passwd"),
      PathValidationError,
    );
  });
});
