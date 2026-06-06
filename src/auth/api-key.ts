import { randomBytes } from "node:crypto";

import argon2 from "argon2";

const API_KEY_PREFIX = "dep_live_";
const KEY_ID_PATTERN = /^[a-zA-Z0-9]{8,32}$/;
const SECRET_PATTERN = /^[a-zA-Z0-9_-]{16,64}$/;

export interface ParsedApiKey {
  keyId: string;
  secret: string;
}

export interface GeneratedApiKey {
  keyId: string;
  secret: string;
  plaintext: string;
}

function randomAlphanumeric(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  
  while (result.length < length) {
    // Generate more bytes than needed to account for discarded bytes (248-255)
    // Exactly 248/256 ≈ 96.875% of bytes will be used (8 out of 256 bytes are discarded)
    const remaining = length - result.length;
    const bytesNeeded = Math.ceil(remaining * (256 / 248)); // Optimal buffer size
    const bytes = randomBytes(bytesNeeded);
    
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      const byte = bytes[i]!;
      // Discard bytes >= 248 to avoid bias in modulo operation
      // 248 = 62 * 4, so only bytes 0-247 are used for uniform distribution
      if (byte < 248) {
        result += alphabet[byte % alphabet.length];
      }
    }
  }
  
  return result;
}

export function parseApiKeyToken(token: string): ParsedApiKey | null {
  if (!token.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  const rest = token.slice(API_KEY_PREFIX.length);
  const underscoreIndex = rest.indexOf("_");
  if (underscoreIndex <= 0) {
    return null;
  }
  const keyId = rest.slice(0, underscoreIndex);
  const secret = rest.slice(underscoreIndex + 1);
  if (!KEY_ID_PATTERN.test(keyId) || !SECRET_PATTERN.test(secret)) {
    return null;
  }
  return { keyId, secret };
}

export function parseBearerAuthorization(authorizationHeader: string | undefined): ParsedApiKey | null {
  if (!authorizationHeader) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match?.[1]) {
    return null;
  }
  return parseApiKeyToken(match[1].trim());
}

export async function generateApiKey(): Promise<GeneratedApiKey> {
  const keyId = randomAlphanumeric(16);
  const secret = randomBytes(32).toString("base64url");
  const plaintext = `${API_KEY_PREFIX}${keyId}_${secret}`;
  return { keyId, secret, plaintext };
}

export async function hashSecret(secret: string): Promise<string> {
  return argon2.hash(secret);
}

export async function verifySecret(hash: string, secret: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, secret);
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
