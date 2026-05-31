import type { DatabaseSync } from "node:sqlite";

import {
  parseApiKeyPublicRow,
  parseApiKeyRow,
  parseRowList,
  type ParsedApiKeyPublicRow,
  type ParsedApiKeyRow,
} from "../sqlite-values.js";

export type ApiKeyRow = ParsedApiKeyRow;
export type ApiKeyPublicRow = ParsedApiKeyPublicRow;

export interface InsertApiKeyInput {
  id: string;
  projectId: string;
  keyId: string;
  secretHash: string;
  name?: string;
  permissions: string[];
  allowedBranches?: string[];
  maxUploadBytes?: number;
  maxFileCount?: number;
  allowedIpCidrs?: string[];
  expiresAt?: string;
  createdAt: string;
}

export function findApiKeyByKeyId(db: DatabaseSync, keyId: string): ApiKeyRow | undefined {
  const stmt = db.prepare(`
    SELECT id, project_id, key_id, secret_hash, name, permissions,
           allowed_branches, max_upload_bytes, max_file_count, allowed_ip_cidrs,
           expires_at, revoked_at, created_at
    FROM api_keys
    WHERE key_id = ?
  `);
  return parseApiKeyRow(stmt.get(keyId));
}

export function listApiKeysByProject(db: DatabaseSync, projectId: string): ApiKeyPublicRow[] {
  const stmt = db.prepare(`
    SELECT id, project_id, key_id, name, permissions,
           allowed_branches, max_upload_bytes, max_file_count, allowed_ip_cidrs,
           expires_at, revoked_at, created_at
    FROM api_keys
    WHERE project_id = ?
    ORDER BY created_at DESC
  `);
  return parseRowList(stmt.all(projectId), parseApiKeyPublicRow);
}

export function insertApiKey(db: DatabaseSync, input: InsertApiKeyInput): void {
  const stmt = db.prepare(`
    INSERT INTO api_keys (
      id, project_id, key_id, secret_hash, name, permissions,
      allowed_branches, max_upload_bytes, max_file_count, allowed_ip_cidrs,
      expires_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    input.id,
    input.projectId,
    input.keyId,
    input.secretHash,
    input.name ?? null,
    JSON.stringify(input.permissions),
    input.allowedBranches ? JSON.stringify(input.allowedBranches) : null,
    input.maxUploadBytes ?? null,
    input.maxFileCount ?? null,
    input.allowedIpCidrs ? JSON.stringify(input.allowedIpCidrs) : null,
    input.expiresAt ?? null,
    input.createdAt,
  );
}

export function revokeApiKey(db: DatabaseSync, id: string, revokedAt: string): boolean {
  const stmt = db.prepare(`
    UPDATE api_keys
    SET revoked_at = ?
    WHERE id = ? AND revoked_at IS NULL
  `);
  const result = stmt.run(revokedAt, id);
  return result.changes > 0;
}

export function findApiKeyById(db: DatabaseSync, id: string): ApiKeyPublicRow | undefined {
  const stmt = db.prepare(`
    SELECT id, project_id, key_id, name, permissions,
           allowed_branches, max_upload_bytes, max_file_count, allowed_ip_cidrs,
           expires_at, revoked_at, created_at
    FROM api_keys
    WHERE id = ?
  `);
  return parseApiKeyPublicRow(stmt.get(id));
}
