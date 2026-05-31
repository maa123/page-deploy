import { z } from "zod";

const stringArraySchema = z.array(z.string());

function parseJsonStringArrayValue(raw: string): string[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const result = stringArraySchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

/** DB に JSON 文字列として保存された string[] を検証して返す。不正な場合は undefined。 */
export function parseJsonStringArray(raw: string | null): string[] | null {
  if (raw === null) {
    return null;
  }
  return parseJsonStringArrayValue(raw) ?? null;
}

/** NOT NULL カラム用。パース失敗時は undefined（拒否すべき）。 */
export function parseRequiredJsonStringArray(raw: string): string[] | undefined {
  return parseJsonStringArrayValue(raw);
}

/**
 * NULL = 制限なし、非 NULL = 制限あり。
 * 非 NULL だがパース不能な値は undefined（拒否すべき）。
 */
export function parseOptionalJsonStringArray(raw: string | null): string[] | null | undefined {
  if (raw === null) {
    return null;
  }
  const parsed = parseJsonStringArrayValue(raw);
  if (parsed === undefined) {
    return undefined;
  }
  return parsed;
}
