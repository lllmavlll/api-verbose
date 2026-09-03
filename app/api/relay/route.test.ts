import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/relay-core", () => ({ performRelay: vi.fn() }));

import { performRelay } from "@/lib/http/relay-core";

import { MAX_RELAY_REQUEST_BYTES, POST, runtime } from "./route";

function request(body: unknown, headers: HeadersInit = {}): Request {
  return new Request("http://app.local/api/relay", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/relay", () => {
  beforeEach(() => {
    vi.mocked(performRelay).mockReset();
  });

  it("is explicitly bound to the Node runtime", () => {
    expect(runtime).toBe("nodejs");
  });

  it("returns 400 for malformed JSON without egress", async () => {
    const response = await POST(
      new Request("http://app.local/api/relay", {
        method: "POST",
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "invalid-url",
    });
    expect(performRelay).not.toHaveBeenCalled();
  });

  it("returns 413 from an oversized declared request without reading it", async () => {
    const response = await POST(
      request(
        { method: "GET", url: "https://example.com" },
        { "content-length": String(MAX_RELAY_REQUEST_BYTES + 1) },
      ),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "too-large",
    });
    expect(performRelay).not.toHaveBeenCalled();
  });

  it.each([
    [{ method: "BREW", url: "https://example.com" }, 400, "method-not-allowed"],
    [{ method: "GET", url: "not a url" }, 400, "invalid-url"],
    [{ method: "GET", url: "file:///etc/passwd" }, 403, "blocked-scheme"],
    [{ method: "GET", url: "https://example.com", headers: "bad" }, 400, "invalid-url"],
    [{ method: "GET", url: "https://example.com", body: 42 }, 400, "invalid-url"],
  ])("rejects invalid relay input %#", async (payload, status, error) => {
    const response = await POST(request(payload));

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ ok: false, error });
    expect(performRelay).not.toHaveBeenCalled();
  });

  it.each([
    ["blocked-scheme", 403],
    ["blocked-address", 403],
    ["too-large", 413],
    ["upstream-unreachable", 502],
    ["timeout", 504],
  ] as const)("maps %s to HTTP %s", async (error, status) => {
    vi.mocked(performRelay).mockResolvedValue({
      ok: false,
      error,
      message: error,
    });

    const response = await POST(
      request({ method: "GET", url: "https://example.com" }),
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ ok: false, error, message: error });
  });

  it("returns an upstream success as relay data rather than setting its headers", async () => {
    vi.mocked(performRelay).mockResolvedValue({
      ok: true,
      status: 201,
      statusText: "Created",
      headers: [
        ["set-cookie", "upstream=secret"],
        ["x-safe", "yes"],
      ],
      bodyText: "created",
    });

    const response = await POST(
      request({ method: "POST", url: "https://example.com" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({
      ok: true,
      status: 201,
      headers: [
        ["set-cookie", "upstream=secret"],
        ["x-safe", "yes"],
      ],
    });
  });
});
