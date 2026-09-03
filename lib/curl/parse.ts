import type {
  Auth,
  Body,
  HttpMethod,
  KV,
  RequestSpec,
} from "@/lib/http/types";
import { isAbsoluteHttpUrl } from "@/lib/http/url";
import { parseParams } from "@/lib/request/params";

import { tokenize } from "./tokenize";

export type ParseError = { ok: false; error: string };
export type ParseOk = { ok: true; spec: RequestSpec; ignored: string[] };
export type ParseResult = ParseOk | ParseError;

const HTTP_METHODS = new Set<HttpMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

const UNSUPPORTED_WITH_VALUE = new Set([
  "--cookie",
  "-b",
  "--form",
  "-F",
  "--output",
  "-o",
  "--user-agent",
  "-A",
  "--data-binary",
  "--proxy",
  "-x",
  "--proxy-user",
  "-U",
  "--noproxy",
  "--haproxy-clientip",
  "--preproxy",
  "--proxy-cacert",
  "--proxy-capath",
  "--proxy-cert",
  "--proxy-cert-type",
  "--proxy-ciphers",
  "--proxy-crlfile",
  "--proxy-header",
  "--proxy-key",
  "--proxy-key-type",
  "--proxy-pass",
  "--proxy-pinnedpubkey",
  "--proxy-service-name",
  "--proxy-tls13-ciphers",
  "--proxy-tlsauthtype",
  "--proxy-tlspassword",
  "--proxy-tlsuser",
  "--proxy1.0",
  "--socks4",
  "--socks4a",
  "--socks5",
  "--socks5-gssapi-service",
  "--socks5-hostname",
]);

const UNSUPPORTED_WITHOUT_VALUE = new Set([
  "--compressed",
  "--insecure",
  "-k",
  "--haproxy-protocol",
  "--proxy-anyauth",
  "--proxy-basic",
  "--proxy-ca-native",
  "--proxy-digest",
  "--proxy-http2",
  "--proxy-insecure",
  "--proxy-negotiate",
  "--proxy-ntlm",
  "--proxy-ssl-allow-beast",
  "--proxy-ssl-auto-client-cert",
  "--proxy-tlsv1",
  "--proxytunnel",
  "-p",
  "--socks5-basic",
  "--socks5-gssapi",
  "--socks5-gssapi-nec",
  "--suppress-connect-headers",
]);

function row(key: string, value: string): KV {
  return { id: crypto.randomUUID(), key, value, enabled: true };
}

function option(token: string): { name: string; inline?: string } {
  if (token.startsWith("--")) {
    const equals = token.indexOf("=");
    return equals === -1
      ? { name: token }
      : { name: token.slice(0, equals), inline: token.slice(equals + 1) };
  }

  for (const name of ["-X", "-H", "-d", "-u", "-b", "-F", "-o", "-A", "-x", "-U"]) {
    if (token.startsWith(name) && token.length > name.length) {
      return { name, inline: token.slice(name.length) };
    }
  }

  return { name: token };
}

function splitHeader(value: string): { key: string; value: string } | null {
  const colon = value.indexOf(":");
  if (colon <= 0) return null;
  const key = value.slice(0, colon).trim();
  if (key === "") return null;
  return { key, value: value.slice(colon + 1).trimStart() };
}

export function parseCurl(input: string): ParseResult {
  let argv: string[];
  try {
    argv = tokenize(input);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not parse curl input.",
    };
  }

  if (argv.length === 0) {
    return { ok: false, error: "Paste a curl command to import." };
  }
  if (argv[0] === "curl") argv = argv.slice(1);

  let url = "";
  let explicitMethod: HttpMethod | null = null;
  const headers: KV[] = [];
  const data: string[] = [];
  let auth: Auth = { kind: "none" };
  const ignored: string[] = [];
  let positionalOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--" && !positionalOnly) {
      positionalOnly = true;
      continue;
    }

    if (!positionalOnly && token.startsWith("-") && token !== "-") {
      const parsed = option(token);
      const readValue = (): string | null => {
        if (parsed.inline !== undefined) return parsed.inline;
        const value = argv[index + 1];
        if (value === undefined) return null;
        index += 1;
        return value;
      };

      if (parsed.name === "-X" || parsed.name === "--request") {
        const value = readValue();
        if (value === null) {
          return { ok: false, error: `${parsed.name} requires a method.` };
        }
        const method = value.toUpperCase();
        if (!HTTP_METHODS.has(method as HttpMethod)) {
          return { ok: false, error: `Unsupported HTTP method: ${value}.` };
        }
        explicitMethod = method as HttpMethod;
        continue;
      }

      if (parsed.name === "--url") {
        const value = readValue();
        if (value === null) {
          return { ok: false, error: "--url requires a URL." };
        }
        url = value;
        continue;
      }

      if (parsed.name === "-H" || parsed.name === "--header") {
        const value = readValue();
        if (value === null) {
          return { ok: false, error: `${parsed.name} requires a header.` };
        }
        const header = splitHeader(value);
        if (!header) {
          return { ok: false, error: `Invalid header: ${value}.` };
        }
        headers.push(row(header.key, header.value));
        continue;
      }

      if (
        parsed.name === "-d" ||
        parsed.name === "--data" ||
        parsed.name === "--data-raw" ||
        parsed.name === "--data-ascii"
      ) {
        const value = readValue();
        if (value === null) {
          return { ok: false, error: `${parsed.name} requires body data.` };
        }
        data.push(value);
        continue;
      }

      if (parsed.name === "-u" || parsed.name === "--user") {
        const value = readValue();
        if (value === null) {
          return { ok: false, error: `${parsed.name} requires credentials.` };
        }
        const colon = value.indexOf(":");
        auth = {
          kind: "basic",
          username: colon === -1 ? value : value.slice(0, colon),
          password: colon === -1 ? "" : value.slice(colon + 1),
        };
        continue;
      }

      if (UNSUPPORTED_WITH_VALUE.has(parsed.name)) {
        ignored.push(parsed.name);
        if (parsed.inline === undefined && readValue() === null) {
          return { ok: false, error: `${parsed.name} requires a value.` };
        }
        continue;
      }

      ignored.push(parsed.name);
      if (UNSUPPORTED_WITHOUT_VALUE.has(parsed.name)) continue;
      continue;
    }

    if (url !== "") {
      return { ok: false, error: "Only one request URL can be imported." };
    }
    url = token;
  }

  if (url === "") {
    return { ok: false, error: "The curl command does not include a URL." };
  }
  if (!isAbsoluteHttpUrl(url)) {
    return { ok: false, error: "The request URL must use HTTP or HTTPS." };
  }

  const contentType = headers.find(
    ({ key }) => key.toLowerCase() === "content-type",
  )?.value;
  let body: Body = { kind: "none" };
  if (data.length > 0) {
    const text = data.join("&");
    body = contentType?.toLowerCase().includes("json")
      ? { kind: "json", text }
      : {
          kind: "raw",
          text,
          contentType: contentType || "application/x-www-form-urlencoded",
        };
  }

  let params: KV[];
  try {
    params = parseParams(url).params;
  } catch {
    return { ok: false, error: "The request URL contains invalid encoding." };
  }

  return {
    ok: true,
    spec: {
      method: explicitMethod ?? (data.length > 0 ? "POST" : "GET"),
      url,
      headers,
      params,
      auth,
      body,
    },
    ignored,
  };
}
