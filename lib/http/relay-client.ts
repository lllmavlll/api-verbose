import {
  isRelayResponse,
  type RelayRequest,
  type RelayResponse,
} from "./relay-contract";

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
