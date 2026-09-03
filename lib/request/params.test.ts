import { expect, it } from "vitest";

import type { KV } from "@/lib/http/types";

import { parseParams, serializeParams } from "./params";

const row = (key: string, value: string, enabled = true): KV => ({
  id: `${key}-${value}`,
  key,
  value,
  enabled,
});

it("parses pairs in order, keeping repeated keys", () => {
  const { base, params } = parseParams("https://x.test/p?a=1&a=2&b=3");

  expect(base).toBe("https://x.test/p");
  expect(params.map(({ key, value, enabled }) => [key, value, enabled])).toEqual([
    ["a", "1", true],
    ["a", "2", true],
    ["b", "3", true],
  ]);
});

it("decodes percent-encoding into human-readable text", () => {
  const { params } = parseParams("https://x.test/p?q=a%20b%26c");

  expect(params[0]).toMatchObject({ key: "q", value: "a b&c" });
});

it("preserves equals signs in values", () => {
  const { params } = parseParams("https://x.test/p?token=a=b=c");

  expect(params[0]).toMatchObject({ key: "token", value: "a=b=c" });
});

it("returns no params when there is no query string", () => {
  expect(parseParams("https://x.test/p")).toEqual({
    base: "https://x.test/p",
    params: [],
  });
});

it("serializes only enabled, named rows and encodes them", () => {
  expect(
    serializeParams("https://x.test/p", [
      row("a", "1"),
      row("", "skip"),
      row("b", "2", false),
      row("q", "a b&c"),
    ]),
  ).toBe("https://x.test/p?a=1&q=a%20b%26c");
});

it("sends an enabled named row with an empty value as key=", () => {
  expect(serializeParams("https://x.test/p", [row("flag", "")])).toBe(
    "https://x.test/p?flag=",
  );
});

it("drops the query entirely when nothing qualifies", () => {
  expect(serializeParams("https://x.test/p", [row("b", "2", false)])).toBe(
    "https://x.test/p",
  );
});

it("round-trips encoded values and repeated keys", () => {
  const url = serializeParams("https://x.test/p", [
    row("q", "a b&c"),
    row("q", "again"),
  ]);

  expect(parseParams(url).params.map(({ key, value }) => [key, value])).toEqual([
    ["q", "a b&c"],
    ["q", "again"],
  ]);
});

it("parses query params before a fragment and keeps the fragment after serialization", () => {
  const { base, params } = parseParams("https://x.test/p?a=1#section%value");

  expect(base).toBe("https://x.test/p#section%value");
  expect(params.map(({ key, value }) => [key, value])).toEqual([["a", "1"]]);
  expect(serializeParams(base, params)).toBe(
    "https://x.test/p?a=1#section%value",
  );
});
