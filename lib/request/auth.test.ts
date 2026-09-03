import { expect, it } from "vitest";

import { applyAuth } from "./auth";

it("None injects nothing", () => {
  expect(applyAuth({ kind: "none" })).toEqual({ headers: [], params: [] });
});

it("Bearer adds an Authorization header", () => {
  const additions = applyAuth({ kind: "bearer", token: "abc" });

  expect(additions.params).toEqual([]);
  expect(additions.headers[0]).toMatchObject({
    key: "Authorization",
    value: "Bearer abc",
    enabled: true,
  });
});

it("Basic base64-encodes username:password", () => {
  const { headers } = applyAuth({
    kind: "basic",
    username: "user",
    password: "pass",
  });

  expect(headers[0]).toMatchObject({
    key: "Authorization",
    value: "Basic dXNlcjpwYXNz",
  });
});

it("API key as header targets the header list", () => {
  const additions = applyAuth({
    kind: "apikey",
    name: "X-Api-Key",
    value: "k",
    in: "header",
  });

  expect(additions.params).toEqual([]);
  expect(additions.headers[0]).toMatchObject({ key: "X-Api-Key", value: "k" });
});

it("API key as query targets the param list", () => {
  const additions = applyAuth({
    kind: "apikey",
    name: "api_key",
    value: "k",
    in: "query",
  });

  expect(additions.headers).toEqual([]);
  expect(additions.params[0]).toMatchObject({ key: "api_key", value: "k" });
});
