import { afterEach, describe, expect, it, vi } from "vitest";

import { sendRequest } from "./send-request";
import type { HttpMethod, RequestSpec } from "./types";

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
          text: async () => {
            clock = 900;
            return "slow body";
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
      bodyText: '{"a":1}',
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
      bodyText: "nope",
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

  it("maps a fetch rejection to a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({ ok: false, kind: "network" });
  });

  it("prefers a valid Content-Length header for response size", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response("short", {
            headers: { "Content-Length": "100" },
          }),
        ),
      ),
    );

    const result = await sendRequest(spec("GET", "https://api.test/x"));

    expect(result).toMatchObject({ ok: true, sizeBytes: 100 });
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
    });
    expect(fetchSpy.mock.calls[0]?.[1]).not.toHaveProperty("body");
  });
});
