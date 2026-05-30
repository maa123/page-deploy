export function redactSecrets(value: string): string {
  return value.replace(/CLOUDFLARE_API_TOKEN=\S+/g, "CLOUDFLARE_API_TOKEN=[redacted]");
}
