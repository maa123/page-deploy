import net, { BlockList } from "node:net";

function parseCidrEntry(entry: string): { address: string; prefix: number; type: "ipv4" | "ipv6" } | null {
  const trimmed = entry.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("/")) {
    const slash = trimmed.lastIndexOf("/");
    const address = trimmed.slice(0, slash);
    const prefix = Number(trimmed.slice(slash + 1));
    const family = net.isIP(address);
    if (family === 4 && Number.isInteger(prefix) && prefix >= 0 && prefix <= 32) {
      return { address, prefix, type: "ipv4" };
    }
    if (family === 6 && Number.isInteger(prefix) && prefix >= 0 && prefix <= 128) {
      return { address, prefix, type: "ipv6" };
    }
    return null;
  }

  const family = net.isIP(trimmed);
  if (family === 4) {
    return { address: trimmed, prefix: 32, type: "ipv4" };
  }
  if (family === 6) {
    return { address: trimmed, prefix: 128, type: "ipv6" };
  }
  return null;
}

/** 管理 API で API Key 作成時に検証する */
export function isValidAllowedIpCidrEntry(entry: string): boolean {
  return parseCidrEntry(entry) !== null;
}

function buildBlockList(allowedCidrs: string[]): BlockList | null {
  const blockList = new BlockList();
  for (const entry of allowedCidrs) {
    const parsed = parseCidrEntry(entry);
    if (!parsed) {
      return null;
    }
    if (parsed.prefix === (parsed.type === "ipv4" ? 32 : 128)) {
      blockList.addAddress(parsed.address, parsed.type);
    } else {
      blockList.addSubnet(parsed.address, parsed.prefix, parsed.type);
    }
  }
  return blockList;
}

export function isIpAllowed(clientIp: string, allowedCidrs: string[]): boolean {
  if (allowedCidrs.length === 0) {
    return false;
  }

  const normalizedIp = clientIp.replace(/^::ffff:/, "");
  const ipFamily = net.isIP(normalizedIp);
  if (ipFamily === 0) {
    return false;
  }

  const blockList = buildBlockList(allowedCidrs);
  if (!blockList) {
    return false;
  }

  const type = ipFamily === 4 ? "ipv4" : "ipv6";
  return blockList.check(normalizedIp, type);
}
