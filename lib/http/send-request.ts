import type { RequestSpec, SendResult } from "./types";
import { base64ToBytes, decodeResponseBody } from "./body-codec";
import { isJsonMediaType } from "./media-type";
import { buildBody } from "./body";
import { relayFetch } from "./relay-client";
import { isAbsoluteHttpUrl } from "./url";

const INVALID_URL_MESSAGE = "Enter a valid absolute HTTP or HTTPS URL.";
const INVALID_HEADERS_MESSAGE =
  "Check the request header names and values, then try again.";
const NETWORK_ERROR_MESSAGE = "The request failed before a response arrived.";
const AMBIGUOUS_WRITE_MESSAGE =
  "The direct request failed, but it was not retried because doing so could duplicate a write.";

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

const STATUS_MEANINGS: Readonly<Record<number, string>> = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  208: "Already Reported",
  226: "IM Used",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  306: "Reserved",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Content Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a Teapot",
  421: "Misdirected Request",
  422: "Unprocessable Content",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  510: "Not Extended",
  511: "Network Authentication Required",
};

function bodyLooksLikeJson(bodyText: string, contentType: string): boolean {
  if (isJsonMediaType(contentType)) {
    return true;
  }

  try {
    JSON.parse(bodyText);
    return true;
  } catch {
    return false;
  }
}

export async function sendRequest(spec: RequestSpec): Promise<SendResult> {
  if (!isAbsoluteHttpUrl(spec.url)) {
    return {
      ok: false,
      kind: "invalid-url",
      message: INVALID_URL_MESSAGE,
    };
  }

  const startedAt = performance.now();
  let response: Response;
  const builtBody = buildBody(spec);
  const headerPairs = spec.headers.flatMap(({ enabled, key, value }) => {
    if (!enabled || key === "") {
      return [];
    }
    if (
      builtBody?.contentType &&
      key.toLowerCase() === "content-type" &&
      value.trim() === ""
    ) {
      return [];
    }
    return [[key, value] as [string, string]];
  });
  if (builtBody?.contentType) {
    headerPairs.push(["Content-Type", builtBody.contentType]);
  }
  const headers = new Headers();
  try {
    for (const [key, value] of headerPairs) {
      headers.append(key, value);
    }
  } catch {
    return {
      ok: false,
      kind: "invalid-headers",
      message: INVALID_HEADERS_MESSAGE,
    };
  }

  try {
    response = await fetch(spec.url, {
      method: spec.method,
      headers,
      ...(builtBody ? { body: builtBody.bodyText } : {}),
    });
  } catch (error) {
    if (!(error instanceof TypeError)) {
      return { ok: false, kind: "network", message: NETWORK_ERROR_MESSAGE };
    }

    if (!IDEMPOTENT_METHODS.has(spec.method)) {
      return { ok: false, kind: "network", message: AMBIGUOUS_WRITE_MESSAGE };
    }

    const relayed = await relayFetch({
      method: spec.method,
      url: spec.url,
      headers: headerPairs,
      ...(builtBody ? { body: builtBody.bodyText } : {}),
    });
    if (!relayed.ok) {
      return { ok: false, kind: "network", message: relayed.message };
    }

    const contentType =
      relayed.headers.find(([name]) => name.toLowerCase() === "content-type")?.[1] ??
      "";
    const body = decodeResponseBody(
      base64ToBytes(relayed.bodyBase64),
      contentType,
    );
    const bodyText = body.encoding === "utf8" ? body.text : "";

    return {
      ok: true,
      via: "relay",
      status: relayed.status,
      statusText:
        relayed.statusText || STATUS_MEANINGS[relayed.status] || "Unknown Status",
      timeMs: performance.now() - startedAt,
      sizeBytes: relayed.sizeBytes,
      body,
      isJson: body.encoding === "utf8" && bodyLooksLikeJson(bodyText, contentType),
      headers: relayed.headers,
      redirects: relayed.redirects,
    };
  }

  const timeMs = performance.now() - startedAt;
  let bodyBytes: Uint8Array;
  try {
    bodyBytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    return {
      ok: false,
      kind: "network",
      message: NETWORK_ERROR_MESSAGE,
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = decodeResponseBody(bodyBytes, contentType);
  const bodyText = body.encoding === "utf8" ? body.text : "";

  return {
    ok: true,
    via: "direct",
    status: response.status,
    statusText:
      response.statusText || STATUS_MEANINGS[response.status] || "Unknown Status",
    timeMs,
    sizeBytes: bodyBytes.byteLength,
    body,
    isJson: body.encoding === "utf8" && bodyLooksLikeJson(bodyText, contentType),
    headers: Array.from(response.headers.entries()),
    redirects: response.redirected
      ? [
          { url: spec.url, status: 0 },
          { url: response.url, status: response.status },
        ]
      : undefined,
  };
}
