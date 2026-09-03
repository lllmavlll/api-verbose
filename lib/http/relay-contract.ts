import { HTTP_METHODS, type HttpMethod } from "./types";

export const MAX_RELAY_RESPONSE_BYTES = 10 * 1024 * 1024;

export const RELAY_ERROR_STATUS = {
  "invalid-url": 400,
  "method-not-allowed": 400,
  "blocked-scheme": 403,
  "blocked-address": 403,
  "too-large": 413,
  "upstream-unreachable": 502,
  timeout: 504,
} as const;

export type RelayErrorCode = keyof typeof RELAY_ERROR_STATUS;

export const RELAY_METHODS = new Set<HttpMethod>(HTTP_METHODS);

export type RelayRequest = {
  method: HttpMethod;
  url: string;
  headers?: [string, string][];
  body?: string;
};

export type RelayResponse =
  | {
      ok: true;
      status: number;
      statusText: string;
      headers: [string, string][];
      bodyBase64: string;
      sizeBytes: number;
      redirects?: { url: string; status: number }[];
    }
  | { ok: false; error: RelayErrorCode; message: string };

export function isHeaderPairs(value: unknown): value is [string, string][] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        entry.every((part) => typeof part === "string"),
    )
  );
}

function decodedBase64Length(data: string): number | null {
  if (
    data.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)
  ) {
    return null;
  }
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  const lastValue = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(
    data[data.length - padding - 1] ?? "",
  );
  if (
    (padding === 2 && (lastValue & 0b1111) !== 0) ||
    (padding === 1 && (lastValue & 0b11) !== 0)
  ) {
    return null;
  }
  return (data.length / 4) * 3 - padding;
}

export function isRelayResponse(value: unknown): value is RelayResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Record<string, unknown>;
  if (result.ok === false) {
    return (
      typeof result.error === "string" &&
      Object.hasOwn(RELAY_ERROR_STATUS, result.error) &&
      typeof result.message === "string"
    );
  }

  return (
    result.ok === true &&
    typeof result.status === "number" &&
    typeof result.statusText === "string" &&
    typeof result.sizeBytes === "number" &&
    Number.isFinite(result.sizeBytes) &&
    result.sizeBytes >= 0 &&
    result.sizeBytes <= MAX_RELAY_RESPONSE_BYTES &&
    isHeaderPairs(result.headers) &&
    typeof result.bodyBase64 === "string" &&
    decodedBase64Length(result.bodyBase64) === result.sizeBytes &&
    (result.redirects === undefined ||
      (Array.isArray(result.redirects) &&
        result.redirects.every(
          (hop) =>
            hop !== null &&
            typeof hop === "object" &&
            typeof (hop as Record<string, unknown>).url === "string" &&
            typeof (hop as Record<string, unknown>).status === "number",
        )))
  );
}
