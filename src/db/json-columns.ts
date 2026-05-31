import { z } from "zod";

const stringArraySchema = z.array(z.string());

/** DB に JSON 文字列として保存された string[] を検証して返す。不正な場合は null。 */
export function parseJsonStringArray(raw: string | null): string[] | null {
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = stringArraySchema.safeParse(parsed);
  return result.success ? result.data : null;
}
