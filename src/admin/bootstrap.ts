import { randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { hashPassword } from "../auth/api-key.js";
import { countAdminUsers, insertAdminUser } from "../db/repositories/admin-users.js";

export interface BootstrapResult {
  created: boolean;
  username?: string;
  generatedPassword?: string;
}

export async function bootstrapAdminUser(
  db: DatabaseSync,
  options: { username: string; password?: string },
): Promise<BootstrapResult> {
  if (countAdminUsers(db) > 0) {
    return { created: false };
  }

  const username = options.username.trim();
  const password = options.password?.trim() || randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(password);
  const createdAt = new Date().toISOString();

  insertAdminUser(db, {
    id: randomUUID(),
    username,
    passwordHash,
    createdAt,
  });

  return {
    created: true,
    username,
    generatedPassword: options.password ? undefined : password,
  };
}
