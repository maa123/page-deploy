import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SCHEMA_SQL } from "./schema.js";

const PRAGMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
`;

export function openDatabase(sqlitePath: string): DatabaseSync {
  const dir = path.dirname(sqlitePath);
  if (dir !== "." && dir !== "") {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(sqlitePath);
  db.exec(PRAGMA_SQL);
  db.exec(SCHEMA_SQL);
  return db;
}

export function openMemoryDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(PRAGMA_SQL);
  db.exec(SCHEMA_SQL);
  return db;
}
