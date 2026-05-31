function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function requireTrimmedEnv(name: string): string {
  const trimmed = requireEnv(name).trim();
  if (trimmed === "") {
    throw new Error(`Missing ${name}`);
  }
  return trimmed;
}

export function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    throw new Error(`Invalid ${name}: must be a positive integer`);
  }
  return Number(trimmed);
}

function parseBooleanEnv(name: string): boolean | undefined {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") {
    return undefined;
  }
  if (raw === "true" || raw === "1" || raw === "yes") {
    return true;
  }
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }
  throw new Error(`Invalid ${name}: must be true or false`);
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

/** @fastify/session の cookie.maxAge はミリ秒 */
export const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function resolveAdminSessionCookieSecure(adminHost: string): boolean {
  const explicit = parseBooleanEnv("ADMIN_SESSION_SECURE");
  if (explicit !== undefined) {
    return explicit;
  }
  return !isLoopbackHost(adminHost);
}

export interface AppConfig {
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  sqlitePath: string;
  host: string;
  port: number;
  adminHost: string;
  adminPort: number;
  adminSessionCookieSecure: boolean;
  sessionSecret: string;
  maxUploadBytes: number;
  maxFileCount: number;
  maxSingleFileBytes: number;
  maxMultipartFields: number;
  maxMultipartFieldSize: number;
  maxMultipartParts: number;
  bodyLimitBytes: number;
}

export function loadConfig(): AppConfig {
  const maxUploadBytes = parsePositiveInt("MAX_UPLOAD_BYTES", 52_428_800);
  const maxFileCount = parsePositiveInt("MAX_FILE_COUNT", 1000);
  const maxSingleFileBytes = parsePositiveInt("MAX_SINGLE_FILE_BYTES", 10_485_760);
  const maxMultipartFields = parsePositiveInt("MAX_MULTIPART_FIELDS", 4);
  const maxMultipartFieldSize = parsePositiveInt("MAX_MULTIPART_FIELD_SIZE", 256);
  const maxMultipartParts = maxFileCount + maxMultipartFields + 2;

  const sessionSecret = requireTrimmedEnv("SESSION_SECRET");
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }

  return {
    cloudflareApiToken: requireEnv("CLOUDFLARE_API_TOKEN"),
    cloudflareAccountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
    sqlitePath: process.env.SQLITE_PATH?.trim() || "./data/app.db",
    host: process.env.HOST ?? "0.0.0.0",
    port: parsePositiveInt("PORT", 3000),
    adminHost: process.env.ADMIN_HOST ?? "127.0.0.1",
    adminPort: parsePositiveInt("ADMIN_PORT", 3001),
    adminSessionCookieSecure: resolveAdminSessionCookieSecure(
      process.env.ADMIN_HOST ?? "127.0.0.1",
    ),
    sessionSecret,
    maxUploadBytes,
    maxFileCount,
    maxSingleFileBytes,
    maxMultipartFields,
    maxMultipartFieldSize,
    maxMultipartParts,
    bodyLimitBytes: maxUploadBytes + maxMultipartParts * maxMultipartFieldSize,
  };
}
