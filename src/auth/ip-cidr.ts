import net from "node:net";

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const bytes: number[] = [];
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      return null;
    }
    bytes.push(n);
  }
  return bytes;
}

function ipv4ToInt(bytes: number[]): number {
  return ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
}

function matchIpv4Cidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split("/");
  if (!network || prefixStr === undefined) {
    return false;
  }
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }
  const ipBytes = parseIpv4(ip);
  const networkBytes = parseIpv4(network);
  if (!ipBytes || !networkBytes) {
    return false;
  }
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ipBytes) & mask) === (ipv4ToInt(networkBytes) & mask);
}

export function isIpAllowed(clientIp: string, allowedCidrs: string[]): boolean {
  if (allowedCidrs.length === 0) {
    return true;
  }

  const normalizedIp = clientIp.replace(/^::ffff:/, "");

  for (const cidr of allowedCidrs) {
    if (cidr.includes("/")) {
      if (matchIpv4Cidr(normalizedIp, cidr)) {
        return true;
      }
      continue;
    }
    if (normalizedIp === cidr) {
      return true;
    }
    const cidrFamily = net.isIP(cidr);
    const ipFamily = net.isIP(normalizedIp);
    if (cidrFamily !== 0 && cidrFamily === ipFamily && normalizedIp === cidr) {
      return true;
    }
  }

  return false;
}
