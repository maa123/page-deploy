/** Fastify の trustProxy オプション（プロキシ背後で request.ip を正しく得る） */
export type TrustProxySetting = boolean | number | string | string[];

/**
 * TRUST_PROXY 環境変数:
 * - 未設定 / false / 0: 信頼しない（ソケットのリモートアドレス）
 * - true: 1 ホップのプロキシを信頼（X-Forwarded-*）
 * - 正の整数: 信頼するプロキシのホップ数
 * - カンマ区切り: 信頼するプロキシの IP / CIDR（例: 10.0.0.0/8,172.16.0.0/12）
 */
export function loadTrustProxy(): TrustProxySetting {
  const raw = process.env.TRUST_PROXY?.trim();
  if (raw === undefined || raw === "") {
    return false;
  }
  const lower = raw.toLowerCase();
  if (lower === "false" || lower === "0" || lower === "no") {
    return false;
  }
  if (lower === "true" || lower === "yes") {
    return true;
  }
  if (/^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  if (raw.includes(",")) {
    return raw.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
  }
  if (raw.includes("/") || /^[\da-f.:]+$/i.test(raw)) {
    return raw;
  }
  throw new Error(
    "Invalid TRUST_PROXY: use true, false, a hop count, or comma-separated proxy IPs/CIDRs",
  );
}
