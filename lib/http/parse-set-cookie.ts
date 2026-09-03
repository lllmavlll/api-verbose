export interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  maxAge?: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  raw: string;
}

const COOKIE_BOUNDARY = /,(?=\s*[^=;,\s]+=)/g;

function splitPair(segment: string): [string, string | undefined] {
  const equalsIndex = segment.indexOf("=");
  if (equalsIndex === -1) {
    return [segment.trim(), undefined];
  }

  return [
    segment.slice(0, equalsIndex).trim(),
    segment.slice(equalsIndex + 1).trim(),
  ];
}

function normalizeSameSite(
  value: string | undefined,
): ParsedCookie["sameSite"] {
  const normalized = value?.toLowerCase();
  if (normalized === "strict") {
    return "Strict";
  }
  if (normalized === "lax") {
    return "Lax";
  }
  if (normalized === "none") {
    return "None";
  }

  return undefined;
}

export function splitSetCookie(headerValue: string): string[] {
  if (headerValue.trim() === "") {
    return [];
  }

  return headerValue
    .split(COOKIE_BOUNDARY)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseCookie(entry: string): ParsedCookie {
  const [pair = "", ...attributeSegments] = entry.split(";");
  const [name, value = ""] = splitPair(pair);
  const cookie: ParsedCookie = {
    name,
    value,
    secure: false,
    httpOnly: false,
    raw: entry,
  };

  for (const segment of attributeSegments) {
    const [attribute, attributeValue] = splitPair(segment);
    switch (attribute.toLowerCase()) {
      case "domain":
        cookie.domain = attributeValue;
        break;
      case "path":
        cookie.path = attributeValue;
        break;
      case "expires":
        cookie.expires = attributeValue;
        break;
      case "max-age":
        cookie.maxAge = attributeValue;
        break;
      case "secure":
        cookie.secure = true;
        break;
      case "httponly":
        cookie.httpOnly = true;
        break;
      case "samesite":
        cookie.sameSite = normalizeSameSite(attributeValue);
        break;
    }
  }

  return cookie;
}

export function parseSetCookie(headerValue: string): ParsedCookie[] {
  return splitSetCookie(headerValue).map(parseCookie);
}

export function cookiesFromHeaders(
  headers: [string, string][],
): ParsedCookie[] {
  return headers.flatMap(([name, value]) =>
    name.toLowerCase() === "set-cookie" ? parseSetCookie(value) : [],
  );
}
