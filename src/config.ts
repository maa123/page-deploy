function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: must be a positive integer`);
  }
  return value;
}

export type Environment = "production" | "preview";

export interface AppConfig {
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  host: string;
  port: number;
  maxUploadBytes: number;
  maxFileCount: number;
  maxSingleFileBytes: number;
}

export function loadConfig(): AppConfig {
  return {
    cloudflareApiToken: requireEnv("CLOUDFLARE_API_TOKEN"),
    cloudflareAccountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
    host: process.env.HOST ?? "0.0.0.0",
    port: parsePositiveInt("PORT", 3000),
    maxUploadBytes: parsePositiveInt("MAX_UPLOAD_BYTES", 52_428_800),
    maxFileCount: parsePositiveInt("MAX_FILE_COUNT", 1000),
    maxSingleFileBytes: parsePositiveInt("MAX_SINGLE_FILE_BYTES", 10_485_760),
  };
}

export function parseEnvironment(value: string): Environment {
  if (value === "production" || value === "preview") {
    return value;
  }
  throw new Error('environment must be "production" or "preview"');
}
