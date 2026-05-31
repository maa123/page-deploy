export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  cf_account_id TEXT NOT NULL,
  cf_project_name TEXT NOT NULL,
  production_branch TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  key_id TEXT UNIQUE NOT NULL,
  secret_hash TEXT NOT NULL,
  name TEXT,
  permissions TEXT NOT NULL,
  allowed_branches TEXT,
  max_upload_bytes INTEGER,
  max_file_count INTEGER,
  allowed_ip_cidrs TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;
