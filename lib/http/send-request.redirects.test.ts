import { afterEach, describe, expect, it, vi } from "vitest";

import { sendRequest } from "./send-request";
import type { RequestSpec } from "./types";

afterEach(() => vi.restoreAllMocks());

const spec: RequestSpec = {
  method: "GET",
  url: "https://api.test/start",
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
};

describe("sendRequest response metadata", () => {
  it("populates headers as [name,value] pairs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("{}", {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const result = await sendRequest(spec);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.headers).toContainEqual([
        "content-type",
        "application/json",
      ]);
    }
  });

  it("records a redirect chain when the response was redirected", async () => {
    const response = new Response("<html></html>", {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
    });
    Object.defineProperty(response, "redirected", { value: true });
    Object.defineProperty(response, "url", {
      value: "https://api.test/final",
    });
    vi.stubGlobal("fetch", vi.fn(async () => response));

    const result = await sendRequest(spec);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirects).toEqual([
        { url: "https://api.test/start", status: 0 },
        { url: "https://api.test/final", status: 200 },
      ]);
    }
  });

  it("omits redirects when the response was not redirected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("{}", { status: 200, statusText: "OK" }),
      ),
    );

    const result = await sendRequest(spec);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirects).toBeUndefined();
    }
  });

  it("preserves image bytes for a local blob preview", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(bytes, {
            status: 200,
            headers: { "Content-Type": "image/png" },
          }),
      ),
    );

    const result = await sendRequest(spec);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sizeBytes).toBe(bytes.byteLength);
      expect(result.body).toEqual({ encoding: "base64", data: "iVBORwD/" });
    }
  });

  it("decodes every exact XML media type as text", async () => {
    const body = "<label>é</label>";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(body, {
            status: 200,
            headers: { "Content-Type": "model/xml; charset=utf-8" },
          }),
      ),
    );

    const result = await sendRequest(spec);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toEqual({ encoding: "utf8", text: body });
    }
  });

  it("does not treat an unrelated json-containing subtype as JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("\u001e{\"a\":1}\n", {
            status: 200,
            headers: { "Content-Type": "application/json-seq" },
          }),
      ),
    );

    const result = await sendRequest(spec);

    expect(result).toMatchObject({ ok: true, isJson: false });
  });
});
