import { expect, it } from "vitest";

import type { RequestSpec } from "@/lib/http/types";

import {
  fromSavedSnapshot,
  suggestName,
  toSavedSnapshot,
} from "./snapshot";

const full: RequestSpec = {
  method: "POST",
  url: "https://api.github.com/repos",
  headers: [
    { id: "h1", key: "Accept", value: "application/json", enabled: true },
  ],
  params: [{ id: "p1", key: "page", value: "2", enabled: true }],
  auth: { kind: "bearer", token: "t" },
  body: { kind: "json", text: '{"a":1}' },
};

it("round-trips a fully populated spec without loss", () => {
  const stored = toSavedSnapshot(full);

  expect(fromSavedSnapshot(stored)).toEqual(full);
});

it("deep-clones so mutating the snapshot does not touch the source", () => {
  const stored = toSavedSnapshot(full);

  stored.headers[0].value = "changed";

  expect(full.headers[0].value).toBe("application/json");
});

it("fills request defaults for fields absent in an older stored row", () => {
  const legacy = {
    method: "GET",
    url: "https://api.test/x",
  } as unknown as RequestSpec;

  expect(fromSavedSnapshot(legacy)).toMatchObject({
    headers: [],
    params: [],
    auth: { kind: "none" },
    body: { kind: "none" },
  });
});

it('suggests "METHOD host/path" and falls back to the raw url', () => {
  expect(suggestName(full)).toBe("POST api.github.com/repos");
  expect(suggestName({ ...full, url: "not a url" })).toBe("POST not a url");
});

it("deep-clones form body fields and API key auth", () => {
  const formSpec: RequestSpec = {
    ...full,
    auth: { kind: "apikey", name: "X-Key", value: "secret", in: "header" },
    body: {
      kind: "form",
      fields: [{ id: "f1", key: "name", value: "Ada", enabled: true }],
    },
  };

  const stored = toSavedSnapshot(formSpec);
  if (stored.body.kind === "form") stored.body.fields[0].value = "Grace";

  expect(formSpec.body).toEqual({
    kind: "form",
    fields: [{ id: "f1", key: "name", value: "Ada", enabled: true }],
  });
});
