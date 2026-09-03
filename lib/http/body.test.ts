import { describe, expect, it } from "vitest";

import { bodyAllows, buildBody, isValidJson, serializeBody } from "./body";
import type { RequestSpec } from "./types";

describe("bodyAllows", () => {
  it("allows POST/PUT/PATCH/DELETE and rejects GET/HEAD/OPTIONS", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      expect(bodyAllows(method)).toBe(true);
    }
    for (const method of ["GET", "HEAD", "OPTIONS"] as const) {
      expect(bodyAllows(method)).toBe(false);
    }
  });
});

describe("serializeBody", () => {
  it("returns null for none", () => {
    expect(serializeBody({ kind: "none" })).toBeNull();
  });

  it("keeps JSON text verbatim and supplies application/json", () => {
    expect(serializeBody({ kind: "json", text: '{"a": 1}' })).toEqual({
      bodyText: '{"a": 1}',
      contentType: "application/json",
    });
  });

  it("returns null for whitespace-only JSON", () => {
    expect(serializeBody({ kind: "json", text: "   " })).toBeNull();
  });

  it("keeps raw text and uses its typed content type or text/plain", () => {
    expect(
      serializeBody({ kind: "raw", text: "hi", contentType: "text/csv" }),
    ).toEqual({ bodyText: "hi", contentType: "text/csv" });
    expect(
      serializeBody({ kind: "raw", text: "hi", contentType: "" }),
    ).toEqual({ bodyText: "hi", contentType: "text/plain" });
  });

  it("returns null for an empty raw body", () => {
    expect(
      serializeBody({ kind: "raw", text: "", contentType: "text/plain" }),
    ).toBeNull();
  });

  it("serializes enabled form rows with keys in order and preserves duplicates", () => {
    const fields = [
      { id: "1", key: "a", value: "1", enabled: true },
      { id: "2", key: "a", value: "2", enabled: true },
      { id: "3", key: "skip", value: "x", enabled: false },
      { id: "4", key: "", value: "noKey", enabled: true },
      { id: "5", key: "b", value: "hello world", enabled: true },
    ];

    expect(serializeBody({ kind: "form", fields })).toEqual({
      bodyText: "a=1&a=2&b=hello+world",
      contentType: "application/x-www-form-urlencoded",
    });
  });

  it("returns null for a form with no valid rows", () => {
    expect(
      serializeBody({
        kind: "form",
        fields: [{ id: "1", key: "", value: "x", enabled: true }],
      }),
    ).toBeNull();
  });
});

describe("isValidJson", () => {
  it("accepts parseable JSON and rejects malformed or empty text", () => {
    expect(isValidJson('{"a":1}')).toBe(true);
    expect(isValidJson("{bad")).toBe(false);
    expect(isValidJson("")).toBe(false);
  });
});

describe("buildBody", () => {
  const base: RequestSpec = {
    method: "POST",
    url: "https://api.test",
    headers: [],
    params: [],
    auth: { kind: "none" },
    body: { kind: "json", text: '{"a":1}' },
  };

  it("serializes with the automatic content type on an allowed method", () => {
    expect(buildBody(base)).toEqual({
      bodyText: '{"a":1}',
      contentType: "application/json",
    });
  });

  it("omits the body entirely on GET", () => {
    expect(buildBody({ ...base, method: "GET" })).toBeNull();
  });

  it("suppresses the automatic type when enabled headers set one explicitly", () => {
    expect(
      buildBody({
        ...base,
        headers: [
          {
            id: "h1",
            key: "Content-Type",
            value: "application/vnd.api+json",
            enabled: true,
          },
        ],
      }),
    ).toEqual({ bodyText: '{"a":1}', contentType: null });
  });

  it("does not treat disabled or empty content-type rows as explicit", () => {
    expect(
      buildBody({
        ...base,
        headers: [
          { id: "h1", key: "Content-Type", value: "", enabled: true },
          { id: "h2", key: "Content-Type", value: "text/xml", enabled: false },
        ],
      }),
    ).toEqual({ bodyText: '{"a":1}', contentType: "application/json" });
  });
});
