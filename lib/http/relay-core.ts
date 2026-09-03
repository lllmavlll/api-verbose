import { lookup } from "node:dns/promises";
import {
  request as httpRequest,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type RequestOptions,
} from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";

import type { HttpMethod } from "./types";
import {
  resolveTarget,
  type ResolvedAddress,
  type Resolver,
} from "./ssrf-guard";

export const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
export const RELAY_TIMEOUT_MS = 30_000;
export const MAX_REDIRECTS = 5;

export const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const FIXED_HOP_BY_HOP = new Set<string>(HOP_BY_HOP);
const NEVER_FORWARD_REQUEST = new Set(["host", "content-length"]);

export type RelayRequest = {
  method: HttpMethod;
  url: string;
  headers?: [string, string][];
  body?: string;
};

export type RelayErrorCode =
  | "invalid-url"
  | "method-not-allowed"
  | "blocked-scheme"
  | "blocked-address"
  | "too-large"
  | "timeout"
  | "upstream-unreachable";

export type RelayResponse =
  | {
      ok: true;
      status: number;
      statusText: string;
      headers: [string, string][];
      bodyText: string;
    }
  | { ok: false; error: RelayErrorCode; message: string };

export type PinnedResponse = {
  status: number;
  statusText: string;
  rawHeaders: string[];
  body: AsyncIterable<Uint8Array>;
};

export type PinnedRequestInput = {
  url: URL;
  method: HttpMethod;
  headers: [string, string][];
  body?: string;
  address: ResolvedAddress;
  signal: AbortSignal;
};

export type PinnedRequest = (
  request: PinnedRequestInput,
) => Promise<PinnedResponse>;

export type RelayDeps = {
  requestImpl?: PinnedRequest;
  resolve?: Resolver;
  timeoutMs?: number;
  maxBytes?: number;
};

export type PinnedRequestOptions = RequestOptions & {
  lookup: LookupFunction;
  servername?: string;
};

const defaultResolver: Resolver = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address, family }) => ({
    address,
    family: family as 4 | 6,
  }));
};

function connectionTokens(headers: [string, string][]): Set<string> {
  const tokens = new Set<string>();
  for (const [name, value] of headers) {
    if (name.toLowerCase() !== "connection") {
      continue;
    }
    for (const token of value.split(",")) {
      const normalized = token.trim().toLowerCase();
      if (normalized) {
        tokens.add(normalized);
      }
    }
  }
  return tokens;
}

function stripHopByHop(
  headers: [string, string][],
  request = false,
): [string, string][] {
  const nominated = connectionTokens(headers);
  return headers.flatMap(([name, value]) => {
    const normalized = name.toLowerCase();
    if (
      FIXED_HOP_BY_HOP.has(normalized) ||
      nominated.has(normalized) ||
      (request && NEVER_FORWARD_REQUEST.has(normalized))
    ) {
      return [];
    }
    return [[normalized, value] as [string, string]];
  });
}

function rawHeaderPairs(rawHeaders: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    pairs.push([rawHeaders[index], rawHeaders[index + 1]]);
  }
  return pairs;
}

function outgoingHeaders(
  headers: [string, string][],
  body: string | undefined,
): OutgoingHttpHeaders {
  const result: OutgoingHttpHeaders = {};
  for (const [name, value] of headers) {
    const previous = result[name];
    if (previous === undefined) {
      result[name] = value;
    } else if (Array.isArray(previous)) {
      previous.push(value);
    } else {
      result[name] = [String(previous), value];
    }
  }

  if (result["user-agent"] === undefined) {
    result["user-agent"] = "Verbose/0.1";
  }

  if (body !== undefined) {
    result["content-length"] = Buffer.byteLength(body);
  }
  return result;
}

export function createPinnedRequestOptions(
  input: Omit<PinnedRequestInput, "body"> & { body?: string },
): PinnedRequestOptions {
  const hostname = input.url.hostname.replace(/^\[|\]$/g, "");
  const pinnedLookup = ((
    _hostname: string,
    options: { all?: boolean },
    callback: (...args: unknown[]) => void,
  ) => {
    if (options.all) {
      callback(null, [input.address]);
      return;
    }
    callback(null, input.address.address, input.address.family);
  }) as LookupFunction;

  return {
    protocol: input.url.protocol,
    hostname,
    port: input.url.port || undefined,
    path: `${input.url.pathname}${input.url.search}`,
    method: input.method,
    headers: outgoingHeaders(input.headers, input.body),
    agent: false,
    servername: input.url.protocol === "https:" ? hostname : undefined,
    signal: input.signal,
    lookup: pinnedLookup,
  };
}

const nodePinnedRequest: PinnedRequest = async (input) =>
  new Promise<PinnedResponse>((resolve, reject) => {
    const request = input.url.protocol === "https:" ? httpsRequest : httpRequest;
    const outgoing = request(createPinnedRequestOptions(input), (response: IncomingMessage) => {
      resolve({
        status: response.statusCode ?? 502,
        statusText: response.statusMessage ?? "",
        rawHeaders: response.rawHeaders,
        body: response,
      });
    });

    outgoing.once("error", reject);
    if (input.body !== undefined) {
      outgoing.write(input.body);
    }
    outgoing.end();
  });

function relayError(
  error: RelayErrorCode,
  message: string,
): Extract<RelayResponse, { ok: false }> {
  return { ok: false, error, message };
}

function abortError(): DOMException {
  return new DOMException("The relay timed out.", "AbortError");
}

async function withAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    throw abortError();
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function cancelBody(bodyStream: AsyncIterable<Uint8Array>): Promise<void> {
  const iterator = bodyStream[Symbol.asyncIterator]();
  await iterator.return?.();
}

async function readCappedBody(
  bodyStream: AsyncIterable<Uint8Array>,
  maxBytes: number,
  controller: AbortController,
): Promise<string | null> {
  const decoder = new TextDecoder();
  const iterator = bodyStream[Symbol.asyncIterator]();
  let bytes = 0;
  let bodyText = "";

  while (true) {
    const next = await withAbort(Promise.resolve(iterator.next()), controller.signal);
    if (next.done) {
      return bodyText + decoder.decode();
    }

    bytes += next.value.byteLength;
    if (bytes > maxBytes) {
      controller.abort();
      await iterator.return?.();
      return null;
    }
    bodyText += decoder.decode(next.value, { stream: true });
  }
}

function firstHeader(headers: [string, string][], name: string): string | null {
  const normalized = name.toLowerCase();
  return headers.find(([key]) => key.toLowerCase() === normalized)?.[1] ?? null;
}

function redirectRequest(
  status: number,
  method: HttpMethod,
  body: string | undefined,
): { method: HttpMethod; body?: string } {
  if (status === 303 || ((status === 301 || status === 302) && method === "POST")) {
    return { method: "GET" };
  }
  return { method, body };
}

export async function performRelay(
  relayRequest: RelayRequest,
  deps: RelayDeps = {},
): Promise<RelayResponse> {
  const requestImpl = deps.requestImpl ?? nodePinnedRequest;
  const resolve = deps.resolve ?? defaultResolver;
  const timeoutMs = deps.timeoutMs ?? RELAY_TIMEOUT_MS;
  const maxBytes = deps.maxBytes ?? MAX_RESPONSE_BYTES;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let currentUrl = relayRequest.url;
  let method = relayRequest.method;
  let body = relayRequest.body;
  const headers = stripHopByHop(relayRequest.headers ?? [], true);

  try {
    for (let redirectCount = 0; ; redirectCount += 1) {
      const target = await withAbort(
        resolveTarget(currentUrl, resolve),
        controller.signal,
      );
      if (!target.allowed) {
        return relayError(target.code, target.reason);
      }

      const upstream = await withAbort(
        requestImpl({
          url: target.url,
          method,
          headers,
          body,
          address: target.address,
          signal: controller.signal,
        }),
        controller.signal,
      );
      const responseHeaders = rawHeaderPairs(upstream.rawHeaders);
      const location = firstHeader(responseHeaders, "location");

      if (REDIRECT_STATUSES.has(upstream.status) && location) {
        await cancelBody(upstream.body);
        if (redirectCount >= MAX_REDIRECTS) {
          return relayError(
            "upstream-unreachable",
            `The upstream exceeded the ${MAX_REDIRECTS}-redirect limit.`,
          );
        }
        const next = new URL(location, target.url);
        ({ method, body } = redirectRequest(upstream.status, method, body));
        currentUrl = next.href;
        continue;
      }

      const contentLength = Number(firstHeader(responseHeaders, "content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        controller.abort();
        await cancelBody(upstream.body);
        return relayError(
          "too-large",
          `The upstream response exceeded the ${maxBytes}-byte relay limit.`,
        );
      }

      const bodyText = await readCappedBody(upstream.body, maxBytes, controller);
      if (bodyText === null) {
        return relayError(
          "too-large",
          `The upstream response exceeded the ${maxBytes}-byte relay limit.`,
        );
      }

      return {
        ok: true,
        status: upstream.status,
        statusText: upstream.statusText,
        headers: stripHopByHop(responseHeaders),
        bodyText,
      };
    }
  } catch {
    if (controller.signal.aborted) {
      return relayError("timeout", "The upstream request timed out.");
    }
    return relayError(
      "upstream-unreachable",
      "The upstream server could not be reached.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
