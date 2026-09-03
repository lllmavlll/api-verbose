import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { parseCurl } from "@/lib/curl/parse";
import { buildBody } from "@/lib/http/body";
import type { Body, KV, RequestSpec } from "@/lib/http/types";

import { generateCurl } from "./curl";

const kv = (key: string, value: string, enabled = true): KV => ({
  id: "x",
  key,
  value,
  enabled,
});

const stripIds = (spec: RequestSpec): RequestSpec => ({
  ...spec,
  headers: spec.headers.map((header) => ({ ...header, id: "x" })),
  params: spec.params.map((param) => ({ ...param, id: "x" })),
  body:
    spec.body.kind === "form"
      ? {
          ...spec.body,
          fields: spec.body.fields.map((field) => ({ ...field, id: "x" })),
        }
      : spec.body,
});

const wireShape = (spec: RequestSpec) => {
  const body = buildBody(spec);
  const headers = spec.headers
    .filter(({ enabled, key }) => enabled && key !== "")
    .map(({ key, value }) => [key, value]);
  if (body?.contentType) headers.push(["Content-Type", body.contentType]);
  return {
    method: spec.method,
    url: spec.url,
    headers,
    body: body?.bodyText ?? null,
    auth: spec.auth.kind === "basic" ? spec.auth : { kind: "none" },
  };
};

describe("generateCurl", () => {
  it("single-quotes values and escapes embedded quotes", () => {
    const spec: RequestSpec = {
      method: "GET",
      url: "https://api.test/x",
      headers: [kv("X-Note", "it's fine")],
      params: [],
      auth: { kind: "none" },
      body: { kind: "none" },
    };
    const output = generateCurl(spec);
    expect(output).toContain("'X-Note: it'\\''s fine'");
    const parsed = parseCurl(output);
    expect(parsed.ok && parsed.spec.headers[0]?.value).toBe("it's fine");
  });

  it("omits disabled headers and data when there is no body", () => {
    const spec: RequestSpec = {
      method: "GET",
      url: "https://api.test/x",
      headers: [kv("X-Skip", "no", false)],
      params: [],
      auth: { kind: "none" },
      body: { kind: "none" },
    };
    const output = generateCurl(spec);
    expect(output).not.toContain("X-Skip");
    expect(output).not.toContain("-d");
  });

  it("round-trips a fully featured supported spec", () => {
    const spec: RequestSpec = {
      method: "POST",
      url: "https://api.test/x?q=one%20two",
      headers: [
        kv("Content-Type", "application/json"),
        kv("X-Env", "dev"),
      ],
      params: [kv("q", "one two")],
      auth: { kind: "basic", username: "alice", password: "s3cret" },
      body: { kind: "json", text: '{"a":1}' },
    };
    const result = parseCurl(generateCurl(spec));
    expect(result.ok).toBe(true);
    if (result.ok) expect(stripIds(result.spec)).toEqual(stripIds(spec));
  });

  it("emits the implicit content type needed by raw and form bodies", () => {
    const raw: RequestSpec = {
      method: "POST",
      url: "https://api.test/x",
      headers: [],
      params: [],
      auth: { kind: "none" },
      body: { kind: "raw", text: "hello", contentType: "text/markdown" },
    };
    const form: RequestSpec = {
      ...raw,
      body: { kind: "form", fields: [kv("a", "one two")] },
    };
    expect(generateCurl(raw)).toContain("Content-Type: text/markdown");
    expect(generateCurl(form)).toContain(
      "-d 'a=one+two'",
    );
  });

  it.each<{ name: string; body: Body }>([
    {
      name: "implicit JSON",
      body: { kind: "json", text: '{"a":1}' },
    },
    {
      name: "raw custom media type",
      body: {
        kind: "raw",
        text: "hello",
        contentType: "text/markdown",
      },
    },
    {
      name: "URL-encoded form",
      body: { kind: "form", fields: [kv("name", "Ada Lovelace")] },
    },
  ])("round-trips $name as the same effective wire request", ({ body }) => {
    const original: RequestSpec = {
      method: "POST",
      url: "https://api.test/x?q=1",
      headers: [kv("X-Env", "dev")],
      params: [kv("q", "1")],
      auth: { kind: "basic", username: "ada", password: "secret" },
      body,
    };
    const parsed = parseCurl(generateCurl(original));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(wireShape(parsed.spec)).toEqual(wireShape(original));
  });

  it("omits an unsendable GET body from the effective request", () => {
    const original: RequestSpec = {
      method: "GET",
      url: "https://api.test/x",
      headers: [],
      params: [],
      auth: { kind: "none" },
      body: { kind: "json", text: '{"draft":true}' },
    };
    expect(generateCurl(original)).not.toContain("-d");
  });

  it("lets Basic auth replace a colliding manual Authorization header", () => {
    const original: RequestSpec = {
      method: "GET",
      url: "https://api.test/x",
      headers: [kv("Authorization", "manual")],
      params: [],
      auth: { kind: "basic", username: "ada", password: "secret" },
      body: { kind: "none" },
    };
    const output = generateCurl(original);
    expect(output).toContain("-u 'ada:secret'");
    expect(output).not.toContain("Authorization: manual");
  });

  it("passes an independent POSIX shell syntax check", () => {
    const original: RequestSpec = {
      method: "POST",
      url: "https://api.test/it's",
      headers: [kv("X-Note", "line one's")],
      params: [],
      auth: { kind: "basic", username: "a", password: "b" },
      body: { kind: "raw", text: "one\ntwo", contentType: "text/plain" },
    };
    const result = spawnSync("/bin/sh", ["-n"], {
      encoding: "utf8",
      input: generateCurl(original),
    });
    expect(result.status, result.stderr).toBe(0);
  });
});
