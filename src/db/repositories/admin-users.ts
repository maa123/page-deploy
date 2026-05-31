import type { DatabaseSync } from "node:sqlite";

import { parseAdminUserRow, parseCount, type ParsedAdminUserRow } from "../sqlite-values.js";

export type AdminUserRow = ParsedAdminUserRow;

export function countAdminUsers(db: DatabaseSync): number {
  const stmt = db.prepare(`SELECT COUNT(*) AS count FROM admin_users`);
  const count = parseCount(stmt.get());
  if (count === undefined) {
    throw new Error("Failed to read admin user count from database");
  }
  return count;
}

export function findAdminByUsername(db: DatabaseSync, username: string): AdminUserRow | undefined {
  const stmt = db.prepare(`
    SELECT id, username, password_hash, created_at
    FROM admin_users
    WHERE username = ?
  `);
  return parseAdminUserRow(stmt.get(username));
}

export function insertAdminUser(
  db: DatabaseSync,
  input: { id: string; username: string; passwordHash: string; createdAt: string },
): void {
  const stmt = db.prepare(`
    INSERT INTO admin_users (id, username, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(input.id, input.username, input.passwordHash, input.createdAt);
}
