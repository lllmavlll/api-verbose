import { expect, it } from "vitest";

import type { KV, RequestSpec } from "@/lib/http/types";

import { composeRequest, detectCollisions } from "./compose";

const kv = (key: string, value: string, enabled = true): KV => ({
  id: `${key}-${value}`,
  key,
  value,
  enabled,
});

const spec = (overrides: Partial<RequestSpec> = {}): RequestSpec => ({
  method: "GET",
  url: "https://x.test/p",
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
  ...overrides,
});

it("folds enabled params into the URL and drops disabled or unnamed rows", () => {
  const wire = composeRequest(
    spec({ params: [kv("a", "1"), kv("b", "2", false), kv("", "x")] }),
  );

  expect(wire.url).toBe("https://x.test/p?a=1");
  expect(wire.params).toEqual([]);
});

it("keeps enabled named manual headers and preserves duplicates", () => {
  const wire = composeRequest(
    spec({
      headers: [
        kv("X-Test", "one"),
        kv("X-Test", "two"),
        kv("Disabled", "x", false),
        kv("", "x"),
      ],
    }),
  );

  expect(wire.headers.map(({ key, value }) => [key, value])).toEqual([
    ["X-Test", "one"],
    ["X-Test", "two"],
  ]);
});

it("merges Bearer auth into wire headers", () => {
  const wire = composeRequest(spec({ auth: { kind: "bearer", token: "T" } }));

  expect(wire.headers).toEqual([
    expect.objectContaining({ key: "Authorization", value: "Bearer T" }),
  ]);
  expect(wire.auth).toEqual({ kind: "none" });
});

it("auth wins case-insensitive header collisions", () => {
  const input = spec({
    headers: [kv("authorization", "manual")],
    auth: { kind: "bearer", token: "T" },
  });
  const wire = composeRequest(input);

  expect(wire.headers).toHaveLength(1);
  expect(wire.headers[0]).toMatchObject({
    key: "Authorization",
    value: "Bearer T",
  });
  expect(detectCollisions(input).headerKeys).toEqual(["authorization"]);
});

it("auth wins an API-key query collision without dropping other duplicates", () => {
  const input = spec({
    params: [kv("api_key", "manual"), kv("other", "one"), kv("other", "two")],
    auth: { kind: "apikey", name: "api_key", value: "real", in: "query" },
  });

  expect(composeRequest(input).url).toBe(
    "https://x.test/p?other=one&other=two&api_key=real",
  );
  expect(detectCollisions(input).paramKeys).toEqual(["api_key"]);
});

it("does not inject an API key until its name is provided", () => {
  const wire = composeRequest(
    spec({ auth: { kind: "apikey", name: "", value: "secret", in: "header" } }),
  );

  expect(wire.headers).toEqual([]);
});

it("preserves the RequestSpec shape expected by the send seam", () => {
  const wire = composeRequest(spec());

  expect(Object.keys(wire).sort()).toEqual([
    "auth",
    "body",
    "headers",
    "method",
    "params",
    "url",
  ]);
});

it("safely composes an accepted URL with a percent sign in its fragment", () => {
  const input = spec({
    url: "https://x.test/p?a=1#%",
    params: [kv("a", "1")],
  });

  expect(() => composeRequest(input)).not.toThrow();
  expect(composeRequest(input).url).toBe("https://x.test/p?a=1#%");
});
