import { afterEach, describe, expect, it, vi } from "vitest";

import * as relayClient from "./relay-client";
import { sendRequest } from "./send-request";
import type { RequestSpec } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const spec = (overrides: Partial<RequestSpec> = {}): RequestSpec => ({
  method: "POST",
  url: "https://api.test",
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "json", text: '{"a":1}' },
  ...overrides,
});

describe("sendRequest body integration", () => {
  it("sends the serialized body and automatic content type", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(
      async () => {
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendRequest(spec());

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe('{"a":1}');
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("omits the body and automatic content type on GET", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendRequest(spec({ method: "GET" }));

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body ?? null).toBeNull();
    expect(new Headers(init.headers).get("Content-Type")).toBeNull();
  });

  it("keeps one explicit content-type header instead of adding the automatic type", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendRequest(
      spec({
        headers: [
          {
            id: "h1",
            key: "Content-Type",
            value: "application/vnd.api+json",
            enabled: true,
          },
        ],
      }),
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe('{"a":1}');
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/vnd.api+json",
    );
  });

  it("replaces an empty content-type row with the automatic type", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendRequest(
      spec({
        headers: [
          { id: "empty", key: "Content-Type", value: "", enabled: true },
        ],
      }),
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("forwards an idempotent body's text and automatic header through relay fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const relaySpy = vi.spyOn(relayClient, "relayFetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: [],
      bodyBase64: "b2s=",
      sizeBytes: 2,
    });

    await sendRequest(spec({ method: "PUT" }));

    expect(relaySpy).toHaveBeenCalledWith({
      method: "PUT",
      url: "https://api.test",
      headers: [["Content-Type", "application/json"]],
      body: '{"a":1}',
    });
  });
});
