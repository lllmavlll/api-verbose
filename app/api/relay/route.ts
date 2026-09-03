import {
  performRelay,
} from "@/lib/http/relay-core";
import {
  isHeaderPairs,
  RELAY_ERROR_STATUS,
  RELAY_METHODS,
  type RelayErrorCode,
  type RelayRequest,
  type RelayResponse,
} from "@/lib/http/relay-contract";
import type { HttpMethod } from "@/lib/http/types";

export const runtime = "nodejs";
export const MAX_RELAY_REQUEST_BYTES = 10 * 1024 * 1024;

function errorResponse(
  error: RelayErrorCode,
  message: string,
  status = RELAY_ERROR_STATUS[error],
): Response {
  return Response.json({ ok: false, error, message }, { status });
}

async function readRequestBody(request: Request): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RELAY_REQUEST_BYTES
  ) {
    return null;
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";

  while (true) {
    const next = await reader.read();
    if (next.done) {
      return text + decoder.decode();
    }
    size += next.value.byteLength;
    if (size > MAX_RELAY_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(next.value, { stream: true });
  }
}

function validateRequest(
  value: unknown,
): RelayRequest | Extract<RelayResponse, { ok: false }> {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      error: "invalid-url",
      message: "The relay request must be a JSON object.",
    };
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.method !== "string" ||
    !RELAY_METHODS.has(candidate.method as HttpMethod)
  ) {
    return {
      ok: false,
      error: "method-not-allowed",
      message: "The requested HTTP method is not allowed.",
    };
  }

  if (typeof candidate.url !== "string") {
    return {
      ok: false,
      error: "invalid-url",
      message: "The relay target must be an absolute HTTP or HTTPS URL.",
    };
  }

  let target: URL;
  try {
    target = new URL(candidate.url);
  } catch {
    return {
      ok: false,
      error: "invalid-url",
      message: "The relay target must be an absolute HTTP or HTTPS URL.",
    };
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return {
      ok: false,
      error: "blocked-scheme",
      message: "Blocked: only HTTP and HTTPS target URLs are allowed.",
    };
  }

  if (candidate.headers !== undefined && !isHeaderPairs(candidate.headers)) {
    return {
      ok: false,
      error: "invalid-url",
      message: "Relay headers must be string name/value pairs.",
    };
  }

  if (candidate.body !== undefined && typeof candidate.body !== "string") {
    return {
      ok: false,
      error: "invalid-url",
      message: "The relay request body must be text.",
    };
  }

  return {
    method: candidate.method as HttpMethod,
    url: target.href,
    headers: candidate.headers as [string, string][] | undefined,
    body: candidate.body as string | undefined,
  };
}

export async function POST(request: Request): Promise<Response> {
  const bodyText = await readRequestBody(request);
  if (bodyText === null) {
    return errorResponse(
      "too-large",
      `The relay request exceeded the ${MAX_RELAY_REQUEST_BYTES}-byte limit.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return errorResponse("invalid-url", "The relay request body is not valid JSON.");
  }

  const validated = validateRequest(parsed);
  if ("ok" in validated) {
    return errorResponse(validated.error, validated.message);
  }

  const result = await performRelay(validated);
  return Response.json(result, {
    status: result.ok ? 200 : RELAY_ERROR_STATUS[result.error],
  });
}
