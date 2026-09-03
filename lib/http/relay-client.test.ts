import { afterEach, describe, expect, it, vi } from "vitest";

import { relayFetch } from "./relay-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("relayFetch", () => {
  it("posts the request without app-origin credentials and returns relay data", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: [["content-type", "application/json"]],
        bodyBase64: "eyJvayI6dHJ1ZX0=",
        sizeBytes: 11,
        redirects: [
          { url: "https://api.example/start", status: 302 },
          { url: "https://api.example/path", status: 200 },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      relayFetch({ method: "GET", url: "https://api.example/path" }),
    ).resolves.toMatchObject({
      ok: true,
      status: 200,
      sizeBytes: 11,
      redirects: [
        { url: "https://api.example/start", status: 302 },
        { url: "https://api.example/path", status: 200 },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/relay",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
      }),
    );
  });

  it("returns a structured relay error from a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            ok: false,
            error: "blocked-address",
            message: "Blocked: target address is not allowed.",
          },
          { status: 403 },
        ),
      ),
    );

    await expect(
      relayFetch({ method: "GET", url: "http://127.0.0.1" }),
    ).resolves.toMatchObject({ ok: false, error: "blocked-address" });
  });

  it("rejects inherited Object prototype names as relay error codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: false,
          error: "toString",
          message: "not a relay error",
        }),
      ),
    );

    await expect(
      relayFetch({ method: "GET", url: "https://api.example/path" }),
    ).resolves.toMatchObject({
      ok: false,
      error: "upstream-unreachable",
    });
  });

  it("maps a transport failure to upstream-unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(
      relayFetch({ method: "GET", url: "https://api.example/path" }),
    ).resolves.toEqual({
      ok: false,
      error: "upstream-unreachable",
      message: "The in-app relay could not be reached.",
    });
  });

  it("fails closed when the route returns malformed data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not-json", { status: 502 })),
    );

    await expect(
      relayFetch({ method: "GET", url: "https://api.example/path" }),
    ).resolves.toMatchObject({
      ok: false,
      error: "upstream-unreachable",
    });
  });

  it.each([
    ["invalid alphabet", { bodyBase64: "!!!!", sizeBytes: 3 }],
    ["non-canonical padding bits", { bodyBase64: "YR==", sizeBytes: 1 }],
    ["decoded size mismatch", { bodyBase64: "YQ==", sizeBytes: 2 }],
  ])("rejects %s in relay response bodies", async (_case, bodyFields) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: [["content-type", "application/octet-stream"]],
          ...bodyFields,
        }),
      ),
    );

    await expect(
      relayFetch({ method: "GET", url: "https://api.example/file" }),
    ).resolves.toMatchObject({
      ok: false,
      error: "upstream-unreachable",
    });
  });
});
