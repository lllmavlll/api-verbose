import type {
  RelayErrorCode,
  RelayRequest,
  RelayResponse,
} from "./relay-core";

const RELAY_ERRORS = new Set<RelayErrorCode>([
  "invalid-url",
  "method-not-allowed",
  "blocked-scheme",
  "blocked-address",
  "too-large",
  "timeout",
  "upstream-unreachable",
]);

function isRelayResponse(value: unknown): value is RelayResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Record<string, unknown>;
  if (result.ok === false) {
    return (
      typeof result.error === "string" &&
      RELAY_ERRORS.has(result.error as RelayErrorCode) &&
      typeof result.message === "string"
    );
  }

  return (
    result.ok === true &&
    typeof result.status === "number" &&
    typeof result.statusText === "string" &&
    Array.isArray(result.headers) &&
    result.headers.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        entry.every((part) => typeof part === "string"),
    ) &&
    typeof result.bodyText === "string"
  );
}

export async function relayFetch(request: RelayRequest): Promise<RelayResponse> {
  try {
    const response = await fetch("/api/relay", {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const result: unknown = await response.json();
    if (isRelayResponse(result)) {
      return result;
    }
  } catch {
    // The same generic failure below covers transport and malformed route responses.
  }

  return {
    ok: false,
    error: "upstream-unreachable",
    message: "The in-app relay could not be reached.",
  };
}
