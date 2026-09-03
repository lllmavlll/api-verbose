import { createServer, request as nodeRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";

import { describe, expect, it, vi } from "vitest";

import {
  createPinnedRequestOptions,
  MAX_REDIRECTS,
  performRelay,
  type PinnedResponse,
} from "./relay-core";
import type { ResolvedAddress } from "./ssrf-guard";

const PUBLIC_V4: ResolvedAddress = {
  address: "93.184.216.34",
  family: 4,
};
const PUBLIC_V6: ResolvedAddress = {
  address: "2606:2800:220:1:248:1893:25c8:1946",
  family: 6,
};

const resolvePublic = vi.fn(async () => [PUBLIC_V4]);

async function* body(...parts: string[]) {
  for (const part of parts) {
    yield new TextEncoder().encode(part);
  }
}

async function* byteBody(...parts: Uint8Array[]) {
  yield* parts;
}

function upstream(
  overrides: Partial<PinnedResponse> = {},
): PinnedResponse {
  return {
    status: 200,
    statusText: "OK",
    rawHeaders: ["content-type", "text/plain"],
    body: body("ok"),
    ...overrides,
  };
}

describe("createPinnedRequestOptions", () => {
  it("keeps the original host and SNI while forcing the approved address", () => {
    const options = createPinnedRequestOptions({
      url: new URL("https://api.example.com:8443/path?q=1"),
      method: "GET",
      headers: [],
      address: PUBLIC_V6,
      signal: new AbortController().signal,
    });

    expect(options).toMatchObject({
      protocol: "https:",
      hostname: "api.example.com",
      port: "8443",
      path: "/path?q=1",
      method: "GET",
      agent: false,
      servername: "api.example.com",
      headers: {
        "user-agent": "Verbose/0.1",
        "accept-encoding": "identity",
      },
    });

    const callback = vi.fn();
    expect(options.lookup).toBeTypeOf("function");
    options.lookup?.("api.example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(
      null,
      "2606:2800:220:1:248:1893:25c8:1946",
      6,
    );

    const allCallback = vi.fn();
    options.lookup?.("api.example.com", { all: true }, allCallback);
    expect(allCallback).toHaveBeenCalledWith(null, [PUBLIC_V6]);
  });

  it("keeps duplicate same-name request headers as separate Node values", () => {
    const options = createPinnedRequestOptions({
      url: new URL("https://api.example.com/path"),
      method: "GET",
      headers: [
        ["x-test", "one"],
        ["x-test", "two"],
      ],
      address: PUBLIC_V4,
      signal: new AbortController().signal,
    });

    expect(options.headers).toMatchObject({
      "x-test": ["one", "two"],
    });
  });

  it("forces identity encoding instead of forwarding compressed response preferences", () => {
    const options = createPinnedRequestOptions({
      url: new URL("https://api.example.com/path"),
      method: "GET",
      headers: [["accept-encoding", "gzip, br"]],
      address: PUBLIC_V4,
      signal: new AbortController().signal,
    });

    expect(options.headers).toMatchObject({
      "accept-encoding": "identity",
    });
  });

  it("emits duplicate same-name fields on the Node wire", async () => {
    let observedRawHeaders: string[] = [];
    const server = createServer((request, response) => {
      observedRawHeaders = request.rawHeaders;
      response.end("ok");
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const { port } = server.address() as AddressInfo;
      const options = createPinnedRequestOptions({
        url: new URL(`http://api.example:${port}/path`),
        method: "GET",
        headers: [
          ["x-test", "one"],
          ["x-test", "two"],
        ],
        address: { address: "127.0.0.1", family: 4 },
        signal: new AbortController().signal,
      });

      await new Promise<void>((resolve, reject) => {
        const request = nodeRequest(options, (response) => {
          response.resume();
          response.once("end", resolve);
        });
        request.once("error", reject);
        request.end();
      });

      const duplicatePairs: [string, string][] = [];
      for (let index = 0; index + 1 < observedRawHeaders.length; index += 2) {
        if (observedRawHeaders[index].toLowerCase() === "x-test") {
          duplicatePairs.push([
            observedRawHeaders[index],
            observedRawHeaders[index + 1],
          ]);
        }
      }
      expect(duplicatePairs).toEqual([
        ["x-test", "one"],
        ["x-test", "two"],
      ]);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

describe("performRelay", () => {
  it("blocks a private literal before opening an outbound request", async () => {
    const requestImpl = vi.fn();

    await expect(
      performRelay(
        { method: "GET", url: "http://127.0.0.1/" },
        { requestImpl, resolve: resolvePublic },
      ),
    ).resolves.toMatchObject({ ok: false, error: "blocked-address" });
    expect(requestImpl).not.toHaveBeenCalled();
  });

  it("blocks an unsupported scheme before opening an outbound request", async () => {
    const requestImpl = vi.fn();

    await expect(
      performRelay(
        { method: "GET", url: "file:///etc/passwd" },
        { requestImpl, resolve: resolvePublic },
      ),
    ).resolves.toMatchObject({ ok: false, error: "blocked-scheme" });
    expect(requestImpl).not.toHaveBeenCalled();
  });

  it("passes the exact approved address with the original URL hostname", async () => {
    const requestImpl = vi.fn(async () => upstream());

    await performRelay(
      { method: "GET", url: "https://example.com/path" },
      { requestImpl, resolve: resolvePublic },
    );

    expect(requestImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.objectContaining({ hostname: "example.com" }),
        address: PUBLIC_V4,
      }),
    );
  });

  it("strips fixed and Connection-nominated hop-by-hop headers both ways", async () => {
    const requestImpl = vi.fn(async () =>
      upstream({
        rawHeaders: [
          "Connection",
          "close, x-response-hop",
          "x-response-hop",
          "remove me",
          "Transfer-Encoding",
          "chunked",
          "x-safe",
          "yes",
        ],
      }),
    );

    const result = await performRelay(
      {
        method: "GET",
        url: "https://example.com/",
        headers: [
          ["Connection", "keep-alive, x-request-hop"],
          ["x-request-hop", "remove me"],
          ["Host", "attacker.example"],
          ["x-safe-request", "yes"],
        ],
      },
      { requestImpl, resolve: resolvePublic },
    );

    expect(requestImpl).toHaveBeenCalledWith(
      expect.objectContaining({ headers: [["x-safe-request", "yes"]] }),
    );
    expect(result).toMatchObject({ ok: true, headers: [["x-safe", "yes"]] });
  });

  it("returns too-large and aborts after streamed bytes cross the cap", async () => {
    let observedSignal: AbortSignal | undefined;
    const requestImpl = vi.fn(async (request) => {
      observedSignal = request.signal;
      return upstream({ body: body("1234", "5678") });
    });

    await expect(
      performRelay(
        { method: "GET", url: "https://example.com/" },
        { requestImpl, resolve: resolvePublic, maxBytes: 7 },
      ),
    ).resolves.toMatchObject({ ok: false, error: "too-large" });
    expect(observedSignal?.aborted).toBe(true);
  });

  it("returns too-large from Content-Length before consuming the body", async () => {
    const requestImpl = vi.fn(async () =>
      upstream({
        rawHeaders: ["Content-Length", "100"],
        body: body("small"),
      }),
    );

    await expect(
      performRelay(
        { method: "GET", url: "https://example.com/" },
        { requestImpl, resolve: resolvePublic, maxBytes: 10 },
      ),
    ).resolves.toMatchObject({ ok: false, error: "too-large" });
  });

  it("aborts a hanging request and returns timeout", async () => {
    const requestImpl = vi.fn(
      async ({ signal }: { signal: AbortSignal }) =>
        new Promise<PinnedResponse>((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    await expect(
      performRelay(
        { method: "GET", url: "https://example.com/" },
        { requestImpl, resolve: resolvePublic, timeoutMs: 5 },
      ),
    ).resolves.toMatchObject({ ok: false, error: "timeout" });
  });

  it("times out a DNS resolution that does not settle", async () => {
    const resolve = vi.fn(async () => new Promise<ResolvedAddress[]>(() => {}));

    await expect(
      performRelay(
        { method: "GET", url: "https://hanging.example/" },
        { requestImpl: vi.fn(), resolve, timeoutMs: 5 },
      ),
    ).resolves.toMatchObject({ ok: false, error: "timeout" });
  });

  it("re-resolves and rejects a redirect into a blocked range", async () => {
    const requestImpl = vi.fn(async () =>
      upstream({
        status: 302,
        statusText: "Found",
        rawHeaders: ["Location", "http://internal.example/"],
        body: body(),
      }),
    );
    const resolve = vi.fn(async (hostname: string) =>
      hostname === "internal.example"
        ? [{ address: "10.0.0.5", family: 4 as const }]
        : [PUBLIC_V4],
    );

    await expect(
      performRelay(
        { method: "GET", url: "https://example.com/" },
        { requestImpl, resolve },
      ),
    ).resolves.toMatchObject({ ok: false, error: "blocked-address" });
    expect(requestImpl).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith("internal.example");
  });

  it("pins a fresh approved address for every public redirect hop", async () => {
    const requestImpl = vi
      .fn()
      .mockResolvedValueOnce(
        upstream({
          status: 307,
          statusText: "Temporary Redirect",
          rawHeaders: ["Location", "https://next.example/final"],
          body: body(),
        }),
      )
      .mockResolvedValueOnce(upstream({ body: body("done") }));
    const resolve = vi.fn(async (hostname: string) =>
      hostname === "next.example" ? [PUBLIC_V6] : [PUBLIC_V4],
    );

    await expect(
      performRelay(
        { method: "GET", url: "https://first.example/start" },
        { requestImpl, resolve },
      ),
    ).resolves.toMatchObject({
      ok: true,
      bodyBase64: "ZG9uZQ==",
      sizeBytes: 4,
      redirects: [
        { url: "https://first.example/start", status: 307 },
        { url: "https://next.example/final", status: 200 },
      ],
    });
    expect(requestImpl).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: expect.objectContaining({ hostname: "next.example" }),
        address: PUBLIC_V6,
      }),
    );
  });

  it("preserves binary response bytes for image preview", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
    const requestImpl = vi.fn(async () =>
      upstream({
        rawHeaders: ["Content-Type", "image/png"],
        body: byteBody(bytes),
      }),
    );

    const result = await performRelay(
      { method: "GET", url: "https://example.com/image.png" },
      { requestImpl, resolve: resolvePublic },
    );

    expect(result).toMatchObject({ ok: true, sizeBytes: bytes.byteLength });
    if (result.ok) {
      expect(result.bodyBase64).toBe("iVBORwD/");
    }
  });

  it.each([
    ["host", "https://attacker.example/final"],
    ["scheme", "http://trusted.example/final"],
  ])("drops user-supplied headers when a redirect changes %s", async (_part, location) => {
    const requestImpl = vi
      .fn()
      .mockResolvedValueOnce(
        upstream({
          status: 307,
          statusText: "Temporary Redirect",
          rawHeaders: ["Location", location],
          body: body(),
        }),
      )
      .mockResolvedValueOnce(upstream());

    await performRelay(
      {
        method: "GET",
        url: "https://trusted.example/start",
        headers: [
          ["Authorization", "Bearer secret"],
          ["X-API-Key", "secret"],
        ],
      },
      { requestImpl, resolve: resolvePublic },
    );

    expect(requestImpl).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        headers: [
          ["authorization", "Bearer secret"],
          ["x-api-key", "secret"],
        ],
      }),
    );
    expect(requestImpl).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ headers: [] }),
    );
  });

  it("retains user-supplied headers on same-origin redirects", async () => {
    const requestImpl = vi
      .fn()
      .mockResolvedValueOnce(
        upstream({
          status: 307,
          statusText: "Temporary Redirect",
          rawHeaders: ["Location", "/final"],
          body: body(),
        }),
      )
      .mockResolvedValueOnce(upstream());
    const headers: [string, string][] = [["Authorization", "Bearer secret"]];

    await performRelay(
      { method: "GET", url: "https://trusted.example/start", headers },
      { requestImpl, resolve: resolvePublic },
    );

    expect(requestImpl).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        headers: [["authorization", "Bearer secret"]],
      }),
    );
  });

  it("stops after the redirect limit", async () => {
    const requestImpl = vi.fn(async () =>
      upstream({
        status: 302,
        rawHeaders: ["Location", "/again"],
        body: body(),
      }),
    );

    await expect(
      performRelay(
        { method: "GET", url: "https://example.com/start" },
        { requestImpl, resolve: resolvePublic },
      ),
    ).resolves.toMatchObject({ ok: false, error: "upstream-unreachable" });
    expect(requestImpl).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it("returns a successful upstream response as decoded data", async () => {
    const requestImpl = vi.fn(async () =>
      upstream({
        status: 201,
        statusText: "Created",
        rawHeaders: [
          "content-type",
          "application/json",
          "set-cookie",
          "one=1",
          "set-cookie",
          "two=2",
        ],
        body: body('{"emoji":"', "🌱", '"}'),
      }),
    );

    await expect(
      performRelay(
        { method: "GET", url: "https://example.com/" },
        { requestImpl, resolve: resolvePublic },
      ),
    ).resolves.toEqual({
      ok: true,
      status: 201,
      statusText: "Created",
      headers: [
        ["content-type", "application/json"],
        ["set-cookie", "one=1"],
        ["set-cookie", "two=2"],
      ],
      bodyBase64: "eyJlbW9qaSI6IvCfjLEifQ==",
      sizeBytes: 16,
    });
  });

  it("rejects an encoded upstream representation instead of treating wire bytes as decoded bytes", async () => {
    const compressed = gzipSync(Buffer.from("x".repeat(1_000_001)));
    const requestImpl = vi.fn(async () =>
      upstream({
        rawHeaders: [
          "content-type",
          "application/json",
          "content-encoding",
          "gzip",
          "content-length",
          String(compressed.byteLength),
        ],
        body: byteBody(new Uint8Array(compressed)),
      }),
    );

    await expect(
      performRelay(
        { method: "GET", url: "https://example.com/" },
        { requestImpl, resolve: resolvePublic },
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: "upstream-unreachable",
      message: expect.stringMatching(/content encoding/i),
    });
  });

  it("maps an outbound connection error without leaking its raw message", async () => {
    const requestImpl = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:443");
    });

    await expect(
      performRelay(
        { method: "GET", url: "https://example.com/" },
        { requestImpl, resolve: resolvePublic },
      ),
    ).resolves.toEqual({
      ok: false,
      error: "upstream-unreachable",
      message: "The upstream server could not be reached.",
    });
  });
});
