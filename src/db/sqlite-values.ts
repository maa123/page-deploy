/** node:sqlite が返す行オブジェクト（カラム名 → 値） */
export type SqliteRow = Record<string, string | number | bigint | Uint8Array | null>;

export function isSqliteRow(value: unknown): value is SqliteRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(row: SqliteRow, column: string): string | undefined {
  const value = row[column];
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function optionalString(row: SqliteRow, column: string): string | null | undefined {
  const value = row[column];
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function optionalInt(row: SqliteRow, column: string): number | null | undefined {
  const value = row[column];
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    if (Number.isSafeInteger(asNumber)) {
      return asNumber;
    }
  }
  return undefined;
}

function requireInt(row: SqliteRow, column: string): number | undefined {
  const value = row[column];
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    if (Number.isSafeInteger(asNumber)) {
      return asNumber;
    }
  }
  return undefined;
}

export interface ParsedProjectRow {
  id: string;
  slug: string;
  cf_account_id: string;
  cf_project_name: string;
  production_branch: string | null;
  status: string;
  created_at: string;
}

export function parseProjectRow(value: unknown): ParsedProjectRow | undefined {
  if (!isSqliteRow(value)) {
    return undefined;
  }
  const id = requireString(value, "id");
  const slug = requireString(value, "slug");
  const cfAccountId = requireString(value, "cf_account_id");
  const cfProjectName = requireString(value, "cf_project_name");
  const productionBranch = optionalString(value, "production_branch");
  const status = requireString(value, "status");
  const createdAt = requireString(value, "created_at");

  if (
    id === undefined ||
    slug === undefined ||
    cfAccountId === undefined ||
    cfProjectName === undefined ||
    productionBranch === undefined ||
    status === undefined ||
    createdAt === undefined
  ) {
    return undefined;
  }

  return {
    id,
    slug,
    cf_account_id: cfAccountId,
    cf_project_name: cfProjectName,
    production_branch: productionBranch,
    status,
    created_at: createdAt,
  };
}

export interface ParsedApiKeyRow {
  id: string;
  project_id: string;
  key_id: string;
  secret_hash: string;
  name: string | null;
  permissions: string;
  allowed_branches: string | null;
  max_upload_bytes: number | null;
  max_file_count: number | null;
  allowed_ip_cidrs: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export function parseApiKeyRow(value: unknown): ParsedApiKeyRow | undefined {
  if (!isSqliteRow(value)) {
    return undefined;
  }
  const id = requireString(value, "id");
  const projectId = requireString(value, "project_id");
  const keyId = requireString(value, "key_id");
  const secretHash = requireString(value, "secret_hash");
  const name = optionalString(value, "name");
  const permissions = requireString(value, "permissions");
  const allowedBranches = optionalString(value, "allowed_branches");
  const maxUploadBytes = optionalInt(value, "max_upload_bytes");
  const maxFileCount = optionalInt(value, "max_file_count");
  const allowedIpCidrs = optionalString(value, "allowed_ip_cidrs");
  const expiresAt = optionalString(value, "expires_at");
  const revokedAt = optionalString(value, "revoked_at");
  const createdAt = requireString(value, "created_at");

  if (
    id === undefined ||
    projectId === undefined ||
    keyId === undefined ||
    secretHash === undefined ||
    name === undefined ||
    permissions === undefined ||
    allowedBranches === undefined ||
    maxUploadBytes === undefined ||
    maxFileCount === undefined ||
    allowedIpCidrs === undefined ||
    expiresAt === undefined ||
    revokedAt === undefined ||
    createdAt === undefined
  ) {
    return undefined;
  }

  return {
    id,
    project_id: projectId,
    key_id: keyId,
    secret_hash: secretHash,
    name,
    permissions,
    allowed_branches: allowedBranches,
    max_upload_bytes: maxUploadBytes,
    max_file_count: maxFileCount,
    allowed_ip_cidrs: allowedIpCidrs,
    expires_at: expiresAt,
    revoked_at: revokedAt,
    created_at: createdAt,
  };
}

export interface ParsedApiKeyPublicRow {
  id: string;
  project_id: string;
  key_id: string;
  name: string | null;
  permissions: string;
  allowed_branches: string | null;
  max_upload_bytes: number | null;
  max_file_count: number | null;
  allowed_ip_cidrs: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export function parseApiKeyPublicRow(value: unknown): ParsedApiKeyPublicRow | undefined {
  if (!isSqliteRow(value)) {
    return undefined;
  }
  const id = requireString(value, "id");
  const projectId = requireString(value, "project_id");
  const keyId = requireString(value, "key_id");
  const name = optionalString(value, "name");
  const permissions = requireString(value, "permissions");
  const allowedBranches = optionalString(value, "allowed_branches");
  const maxUploadBytes = optionalInt(value, "max_upload_bytes");
  const maxFileCount = optionalInt(value, "max_file_count");
  const allowedIpCidrs = optionalString(value, "allowed_ip_cidrs");
  const expiresAt = optionalString(value, "expires_at");
  const revokedAt = optionalString(value, "revoked_at");
  const createdAt = requireString(value, "created_at");

  if (
    id === undefined ||
    projectId === undefined ||
    keyId === undefined ||
    name === undefined ||
    permissions === undefined ||
    allowedBranches === undefined ||
    maxUploadBytes === undefined ||
    maxFileCount === undefined ||
    allowedIpCidrs === undefined ||
    expiresAt === undefined ||
    revokedAt === undefined ||
    createdAt === undefined
  ) {
    return undefined;
  }

  return {
    id,
    project_id: projectId,
    key_id: keyId,
    name,
    permissions,
    allowed_branches: allowedBranches,
    max_upload_bytes: maxUploadBytes,
    max_file_count: maxFileCount,
    allowed_ip_cidrs: allowedIpCidrs,
    expires_at: expiresAt,
    revoked_at: revokedAt,
    created_at: createdAt,
  };
}

export interface ParsedAdminUserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export function parseAdminUserRow(value: unknown): ParsedAdminUserRow | undefined {
  if (!isSqliteRow(value)) {
    return undefined;
  }
  const id = requireString(value, "id");
  const username = requireString(value, "username");
  const passwordHash = requireString(value, "password_hash");
  const createdAt = requireString(value, "created_at");

  if (id === undefined || username === undefined || passwordHash === undefined || createdAt === undefined) {
    return undefined;
  }

  return {
    id,
    username,
    password_hash: passwordHash,
    created_at: createdAt,
  };
}

export function parseCount(value: unknown): number | undefined {
  if (!isSqliteRow(value)) {
    return undefined;
  }
  return requireInt(value, "count");
}

export function parseRowList<T>(
  rows: unknown[],
  parse: (row: unknown) => T | undefined,
): T[] {
  const result: T[] = [];
  for (const row of rows) {
    const parsed = parse(row);
    if (parsed !== undefined) {
      result.push(parsed);
    }
  }
  return result;
}
