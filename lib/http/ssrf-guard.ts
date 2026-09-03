import { isIP } from "node:net";

export type GuardCode = "blocked-scheme" | "blocked-address";

export type GuardVerdict =
  | { allowed: true }
  | { allowed: false; code: GuardCode; reason: string };

export type GuardFailure = Extract<GuardVerdict, { allowed: false }>;

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export type AllowedTarget = {
  allowed: true;
  url: URL;
  address: ResolvedAddress;
};

const BLOCKED_SCHEME_REASON =
  "Blocked: only absolute HTTP and HTTPS target URLs are allowed.";
const BLOCKED_ADDRESS_REASON = "Blocked: target address is not allowed.";

function parseIpv4(address: string): number[] | null {
  if (isIP(address) !== 4) {
    return null;
  }

  return address.split(".").map(Number);
}

function parseIpv6(address: string): number[] | null {
  const withoutZone = address.split("%", 1)[0].toLowerCase();
  if (isIP(withoutZone) !== 6) {
    return null;
  }

  let normalized = withoutZone;
  const dottedTail = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dottedTail) {
    const bytes = parseIpv4(dottedTail);
    if (!bytes) {
      return null;
    }
    const high = ((bytes[0] << 8) | bytes[1]).toString(16);
    const low = ((bytes[2] << 8) | bytes[3]).toString(16);
    normalized = `${normalized.slice(0, -dottedTail.length)}${high}:${low}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) {
    return null;
  }

  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) {
    return null;
  }

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ].map((part) => Number.parseInt(part || "0", 16));

  return groups.length === 8 && groups.every((group) => group <= 0xffff)
    ? groups
    : null;
}

function isBlockedIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) {
    return true;
  }

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && octets[2] === 0) ||
    (a === 192 && b === 0 && octets[2] === 2) ||
    (a === 192 && b === 88 && octets[2] === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113) ||
    a >= 224 ||
    address === "168.63.129.16"
  );
}

export function isBlockedAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, "");
  const family = isIP(normalized.split("%", 1)[0]);

  if (family === 4) {
    return isBlockedIpv4(normalized);
  }

  if (family !== 6) {
    return true;
  }

  const groups = parseIpv6(normalized);
  if (!groups) {
    return true;
  }

  const isUnspecified = groups.every((group) => group === 0);
  const isLoopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  const isUniqueLocal = (groups[0] & 0xfe00) === 0xfc00;
  const isLinkLocal = (groups[0] & 0xffc0) === 0xfe80;
  const isIpv4Mapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;

  if (isIpv4Mapped) {
    const mapped = [
      groups[6] >> 8,
      groups[6] & 0xff,
      groups[7] >> 8,
      groups[7] & 0xff,
    ].join(".");
    return isBlockedIpv4(mapped);
  }

  const isIpv4Compatible = groups.slice(0, 6).every((group) => group === 0);
  const isTranslationPrefix =
    groups[0] === 0x64 &&
    groups[1] === 0xff9b &&
    (groups[2] === 0 || groups[2] === 1);
  const isDiscardOnly =
    groups[0] === 0x100 && groups.slice(1, 4).every((group) => group === 0);
  const isProtocolAssignment =
    groups[0] === 0x2001 && groups[1] <= 0x01ff;
  const isDocumentationV6 =
    groups[0] === 0x2001 && groups[1] === 0x0db8;
  const isSixToFour = groups[0] === 0x2002;
  const isDocumentation =
    groups[0] === 0x3fff && (groups[1] & 0xf000) === 0;
  const isSegmentRouting = groups[0] === 0x5f00;
  const isMulticast = (groups[0] & 0xff00) === 0xff00;
  const isOutsideGlobalUnicast = (groups[0] & 0xe000) !== 0x2000;

  return (
    isUnspecified ||
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    isIpv4Compatible ||
    isTranslationPrefix ||
    isDiscardOnly ||
    isProtocolAssignment ||
    isDocumentationV6 ||
    isSixToFour ||
    isDocumentation ||
    isSegmentRouting ||
    isMulticast ||
    isOutsideGlobalUnicast
  );
}

export function checkUrl(
  rawUrl: string,
):
  | { allowed: true; url: URL }
  | { allowed: false; code: "blocked-scheme"; reason: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      allowed: false,
      code: "blocked-scheme",
      reason: BLOCKED_SCHEME_REASON,
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      allowed: false,
      code: "blocked-scheme",
      reason: BLOCKED_SCHEME_REASON,
    };
  }

  return { allowed: true, url };
}

export async function resolveTarget(
  rawUrl: string,
  resolve: Resolver,
): Promise<AllowedTarget | GuardFailure> {
  const checked = checkUrl(rawUrl);
  if (!checked.allowed) {
    return checked;
  }

  const hostname = checked.url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  const addresses: ResolvedAddress[] = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await resolve(hostname);

  if (
    addresses.length === 0 ||
    addresses.some(
      ({ address, family }) =>
        isIP(address.split("%", 1)[0]) !== family || isBlockedAddress(address),
    )
  ) {
    return {
      allowed: false,
      code: "blocked-address",
      reason: BLOCKED_ADDRESS_REASON,
    };
  }

  return {
    allowed: true,
    url: checked.url,
    address: addresses[0],
  };
}

export async function assertTargetAllowed(
  rawUrl: string,
  resolve: Resolver,
): Promise<GuardVerdict> {
  const result = await resolveTarget(rawUrl, resolve);
  return result.allowed
    ? { allowed: true }
    : { allowed: false, code: result.code, reason: result.reason };
}
