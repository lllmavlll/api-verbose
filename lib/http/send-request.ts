import type { RequestSpec, SendResult } from "./types";
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
  if (contentType.toLowerCase().includes("json")) {
    return true;
  }

  try {
    JSON.parse(bodyText);
    return true;
  } catch {
    return false;
  }
}

function responseSize(bodyText: string, contentLength: string | null): number {
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength >= 0) {
      return parsedLength;
    }
  }

  return new TextEncoder().encode(bodyText).length;
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
  const headerPairs = spec.headers.map(
    ({ key, value }) => [key, value] as [string, string],
  );
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
    });
    if (!relayed.ok) {
      return { ok: false, kind: "network", message: relayed.message };
    }

    const contentType =
      relayed.headers.find(([name]) => name.toLowerCase() === "content-type")?.[1] ??
      "";
    const contentLength =
      relayed.headers.find(([name]) => name.toLowerCase() === "content-length")?.[1] ??
      null;

    return {
      ok: true,
      via: "relay",
      status: relayed.status,
      statusText:
        relayed.statusText || STATUS_MEANINGS[relayed.status] || "Unknown Status",
      timeMs: performance.now() - startedAt,
      sizeBytes: responseSize(relayed.bodyText, contentLength),
      bodyText: relayed.bodyText,
      isJson: bodyLooksLikeJson(relayed.bodyText, contentType),
      headers: relayed.headers,
    };
  }

  const timeMs = performance.now() - startedAt;
  let bodyText: string;
  try {
    bodyText = await response.text();
  } catch {
    return {
      ok: false,
      kind: "network",
      message: NETWORK_ERROR_MESSAGE,
    };
  }

  return {
    ok: true,
    via: "direct",
    status: response.status,
    statusText:
      response.statusText || STATUS_MEANINGS[response.status] || "Unknown Status",
    timeMs,
    sizeBytes: responseSize(bodyText, response.headers.get("content-length")),
    bodyText,
    isJson: bodyLooksLikeJson(
      bodyText,
      response.headers.get("content-type") ?? "",
    ),
    headers: Array.from(response.headers.entries()),
  };
}
