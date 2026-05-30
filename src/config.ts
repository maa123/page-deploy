function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
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

export interface AppConfig {
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  host: string;
  port: number;
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

  return {
    cloudflareApiToken: requireEnv("CLOUDFLARE_API_TOKEN"),
    cloudflareAccountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
    host: process.env.HOST ?? "0.0.0.0",
    port: parsePositiveInt("PORT", 3000),
    maxUploadBytes,
    maxFileCount,
    maxSingleFileBytes,
    maxMultipartFields,
    maxMultipartFieldSize,
    maxMultipartParts,
    bodyLimitBytes: maxUploadBytes + maxMultipartParts * maxMultipartFieldSize,
  };
}
