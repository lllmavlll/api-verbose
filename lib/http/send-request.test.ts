import { afterEach, describe, expect, it, vi } from "vitest";

import * as relayClient from "./relay-client";
import { sendRequest } from "./send-request";
import type { Body, HttpMethod, RequestSpec } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const spec = (method: HttpMethod, url: string): RequestSpec => ({
  method,
  url,
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
});

describe("sendRequest", () => {
  it.each<[Body, string, string]>([
    [
      { kind: "json", text: '{"name":"Ada"}' },
      '{"name":"Ada"}',
      "application/json",
    ],
    [
      { kind: "raw", text: "hello", contentType: "text/plain" },
      "hello",
      "text/plain",
    ],
    [
      {
        kind: "form",
        fields: [
          { id: "one", key: "name", value: "Ada Lovelace", enabled: true },
          { id: "two", key: "skip", value: "ignored", enabled: false },
        ],
      },
      "name=Ada+Lovelace",
      "application/x-www-form-urlencoded",
    ],
  ])("sends a composed %s body and its default content type directly", async (body, expectedBody, expectedType) => {
    let boundaryRequest: Request | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        boundaryRequest = new Request(input, init);
        return new Response("ok");
      }),
    );

    await sendRequest({
      ...spec("POST", "https://api.test/body"),
      body,
    });

    expect(await boundaryRequest?.text()).toBe(expectedBody);
    expect(boundaryRequest?.headers.get("content-type")).toBe(expectedType);
  });

  it("preserves an explicit content type for a composed body", async () => {
    let boundaryRequest: Request | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        boundaryRequest = new Request(input, init);
        return new Response("ok");
      }),
    );

    await sendRequest({
      ...spec("POST", "https://api.test/body"),
      headers: [{
        id: "content-type",
        key: "Content-Type",
        value: "application/vnd.api+json",
        enabled: true,
      }],
      body: { kind: "json", text: "{}" },
    });

    expect(boundaryRequest?.headers.get("content-type")).toBe(
      "application/vnd.api+json",
    );
  });

  it("serializes the same composed body through the real relay client boundary", async () => {
    let relayPayload: unknown;
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (input === "https://api.test/body") {
        throw new TypeError("Failed to fetch");
      }

      const relayRequest = new Request(
        new URL(String(input), "http://app.local"),
        init,
      );
      relayPayload = await relayRequest.json();
      return Response.json({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: [],
        bodyBase64: "b2s=",
        sizeBytes: 2,
      });
    }));

    const result = await sendRequest({
      ...spec("PUT", "https://api.test/body"),
      body: { kind: "raw", text: "hello", contentType: "text/plain" },
    });

    expect(relayPayload).toEqual({
      method: "PUT",
      url: "https://api.test/body",
      headers: [["Content-Type", "text/plain"]],
      body: "hello",
    });
    expect(result).toMatchObject({ ok: true, via: "relay" });
  });

  it("appends headers from the request spec to fetch", async () => {
    const fetchSpy = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response("ok");
      },
    );
    vi.stubGlobal("fetch", fetchSpy);

    await sendRequest({
      ...spec("GET", "https://api.test/x"),
      headers: [
        { id: "header-1", key: "X-Test", value: "one", enabled: true },
        { id: "header-2", key: "X-Test", value: "two", enabled: true },
      ],
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const sent = new Headers(init.headers);
    expect(sent.get("x-test")).toBe("one, two");
  });

  it("measures until fetch resolves without including body decoding", async () => {
    let clock = 100;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        clock = 125;
        return {
          status: 200,
          statusText: "OK",
          headers: new Headers(),
          arrayBuffer: async () => {
            clock = 900;
            return new TextEncoder().encode("slow body").buffer;
          },
        } as Response;
      }),
    );

    const result = await sendRequest(spec("GET", "https://api.test/slow"));

    expect(result).toMatchObject({ ok: true, timeMs: 25 });
  });

  it("returns status, size, JSON metadata, and headers for a 2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response('{"a":1}', {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      isJson: true,
      body: { encoding: "utf8", text: '{"a":1}' },
      via: "direct",
    });
    if (result.ok) {
      expect(result.timeMs).toBeGreaterThanOrEqual(0);
      expect(result.sizeBytes).toBe(7);
      expect(result.headers).toContainEqual([
        "content-type",
        "application/json",
      ]);
    }
  });

  it("treats a 404 with a body as a normal result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response("nope", { status: 404, statusText: "Not Found" }),
        ),
      ),
    );

    const result = await sendRequest(
      spec("GET", "https://api.test/missing"),
    );

    expect(result).toMatchObject({
      ok: true,
      status: 404,
      isJson: false,
      body: { encoding: "utf8", text: "nope" },
      via: "direct",
    });
  });

  it("rejects an invalid URL before fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendRequest(spec("GET", "not a url"));

    expect(result).toEqual({
      ok: false,
      kind: "invalid-url",
      message: expect.any(String),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a non-http URL before fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendRequest(spec("GET", "file:///tmp/test"));

    expect(result).toMatchObject({ ok: false, kind: "invalid-url" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back through the relay after an idempotent TypeError rejection", async () => {
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
      headers: [["content-type", "application/json"]],
      bodyBase64: "eyJyZWxheWVkIjp0cnVlfQ==",
      sizeBytes: 16,
      redirects: [
        { url: "https://api.test/start", status: 302 },
        { url: "https://api.test/x", status: 200 },
      ],
    });

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(relaySpy).toHaveBeenCalledWith({
      method: "GET",
      url: "https://api.test/x",
      headers: [],
    });
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      isJson: true,
      body: { encoding: "utf8", text: '{"relayed":true}' },
      via: "relay",
      sizeBytes: 16,
      redirects: [
        { url: "https://api.test/start", status: 302 },
        { url: "https://api.test/x", status: 200 },
      ],
    });
  });

  it("preserves duplicate request headers through relay fallback", async () => {
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

    await sendRequest({
      ...spec("GET", "https://api.test/x"),
      headers: [
        { id: "header-1", key: "X-Test", value: "one", enabled: true },
        { id: "header-2", key: "X-Test", value: "two", enabled: true },
      ],
    });

    expect(relaySpy).toHaveBeenCalledWith({
      method: "GET",
      url: "https://api.test/x",
      headers: [
        ["X-Test", "one"],
        ["X-Test", "two"],
      ],
    });
  });

  it.each([
    ["Bad Header", "value"],
    ["X-Test", "line one\nline two"],
  ])(
    "returns a local validation failure for an invalid header without relaying",
    async (key, value) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const relaySpy = vi.spyOn(relayClient, "relayFetch");

      const result = await sendRequest({
        ...spec("GET", "https://api.test/x"),
        headers: [{ id: "invalid", key, value, enabled: true }],
      });

      expect(result).toMatchObject({
        ok: false,
        kind: "invalid-headers",
        message: expect.stringMatching(/header/i),
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(relaySpy).not.toHaveBeenCalled();
    },
  );

  it.each(["POST", "PATCH"] as const)(
    "does not silently re-fire an ambiguous %s rejection",
    async (method) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("Failed to fetch");
        }),
      );
      const relaySpy = vi.spyOn(relayClient, "relayFetch");

      const result = await sendRequest(spec(method, "https://api.test/x"));

      expect(result).toMatchObject({
        ok: false,
        kind: "network",
        message: expect.stringMatching(/not retried|duplicate/i),
      });
      expect(relaySpy).not.toHaveBeenCalled();
    },
  );

  it("does not relay a non-TypeError direct failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("application failure");
      }),
    );
    const relaySpy = vi.spyOn(relayClient, "relayFetch");

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({ ok: false, kind: "network" });
    expect(relaySpy).not.toHaveBeenCalled();
  });

  it("maps a named relay failure to the existing network error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    vi.spyOn(relayClient, "relayFetch").mockResolvedValue({
      ok: false,
      error: "blocked-address",
      message: "Blocked: target address is not allowed.",
    });

    const result = await sendRequest(spec("DELETE", "https://api.test/x"));

    expect(result).toEqual({
      ok: false,
      kind: "network",
      message: "Blocked: target address is not allowed.",
    });
  });

  it("never relays a direct non-2xx response that arrived", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    const relaySpy = vi.spyOn(relayClient, "relayFetch");

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({ ok: true, status: 503, via: "direct" });
    expect(relaySpy).not.toHaveBeenCalled();
  });

  it("does not relay when a received response body fails to decode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({
          status: 200,
          statusText: "OK",
          headers: new Headers(),
          text: async () => {
            throw new TypeError("body stream failed");
          },
        }) as unknown as Response,
      ),
    );
    const relaySpy = vi.spyOn(relayClient, "relayFetch");

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({ ok: false, kind: "network" });
    expect(relaySpy).not.toHaveBeenCalled();
  });

  it("uses decoded body bytes instead of a compressed Content-Length", async () => {
    const decoded = new Uint8Array(1_000_001);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          status: 200,
          statusText: "OK",
          redirected: false,
          url: "https://api.test/x",
          headers: new Headers({
            "Content-Encoding": "gzip",
            "Content-Length": "100",
            "Content-Type": "application/json",
          }),
          arrayBuffer: async () => decoded.buffer,
        } as Response),
      ),
    );

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({ ok: true, sizeBytes: decoded.byteLength });
  });

  it("supplies the standard meaning when fetch omits status text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.resolve(new Response("ok", { status: 200 }))),
    );

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({ ok: true, status: 200, statusText: "OK" });
  });

  it.each([
    [207, "Multi-Status"],
    [305, "Use Proxy"],
  ])(
    "supplies the meaning for less-common standard status %i",
    async (status, statusText) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Promise.resolve(new Response("ok", { status }))),
      );

      const result = await sendRequest(spec("GET", "https://api.test/x"));

      expect(result).toMatchObject({ ok: true, status, statusText });
    },
  );

  it("recognizes valid JSON without a JSON content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response('{"a":1}', {
            headers: { "Content-Type": "text/plain" },
          }),
        ),
      ),
    );

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({ ok: true, isJson: true });
  });

  it("counts UTF-8 bytes when Content-Length is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.resolve(new Response("€"))),
    );

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({ ok: true, sizeBytes: 3 });
  });

  it("forwards the method without adding a request body", async () => {
    const fetchSpy = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Promise.resolve(new Response("ok"));
      },
    );
    vi.stubGlobal("fetch", fetchSpy);

    await sendRequest(spec("POST", "https://api.test/x"));

    expect(fetchSpy).toHaveBeenCalledWith("https://api.test/x", {
      method: "POST",
      headers: new Headers(),
    });
    expect(fetchSpy.mock.calls[0]?.[1]).not.toHaveProperty("body");
  });
});
