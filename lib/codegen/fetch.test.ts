import { describe, expect, it } from "vitest";

import type { RequestSpec } from "@/lib/http/types";

import { generateFetch } from "./fetch";

function spec(patch: Partial<RequestSpec> = {}): RequestSpec {
  return {
    method: "GET",
    url: "https://api.test/x",
    headers: [],
    params: [],
    auth: { kind: "none" },
    body: { kind: "none" },
    ...patch,
  };
}

describe("generateFetch", () => {
  it("emits a syntactically valid JSON.stringify body", () => {
    const output = generateFetch(
      spec({
        method: "POST",
        headers: [
          {
            id: "1",
            key: "Content-Type",
            value: "application/json",
            enabled: true,
          },
        ],
        body: { kind: "json", text: '{"a":1}' },
      }),
    );
    expect(output).toContain("fetch('https://api.test/x'");
    expect(output).toContain("method: 'POST'");
    expect(output).toContain("body: JSON.stringify(");
    expect(() => new Function("fetch", `return ${output}`)).not.toThrow();
  });

  it("omits body when the request has none", () => {
    expect(generateFetch(spec())).not.toContain("body:");
  });

  it("emits Basic auth through btoa and lets it override a manual header", () => {
    const output = generateFetch(
      spec({
        headers: [
          {
            id: "1",
            key: "Authorization",
            value: "manual",
            enabled: true,
          },
        ],
        auth: { kind: "basic", username: "a", password: "b" },
      }),
    );
    expect(output).toContain("btoa('a:b')");
    expect(output).not.toContain("manual");
  });

  it("keeps invalid JSON runnable and byte-faithful as a string body", () => {
    const output = generateFetch(
      spec({ method: "POST", body: { kind: "json", text: "{broken" } }),
    );
    expect(output).toContain("body: '{broken'");
    expect(() => new Function("fetch", `return ${output}`)).not.toThrow();
  });

  it("escapes quotes and newlines in raw bodies", () => {
    const output = generateFetch(
      spec({
        method: "POST",
        body: { kind: "raw", text: "it's\nraw", contentType: "text/plain" },
      }),
    );
    expect(output).toContain("body: 'it\\'s\\nraw'");
    expect(() => new Function("fetch", `return ${output}`)).not.toThrow();
  });

  it("selects JSON.stringify from the effective Content-Type", () => {
    const rawJson = generateFetch(
      spec({
        method: "POST",
        body: {
          kind: "raw",
          text: '{"raw":true}',
          contentType: "application/problem+json",
        },
      }),
    );
    const jsonAsText = generateFetch(
      spec({
        method: "POST",
        headers: [
          {
            id: "ct",
            key: "Content-Type",
            value: "text/plain",
            enabled: true,
          },
        ],
        body: { kind: "json", text: '{"text":true}' },
      }),
    );
    expect(rawJson).toContain("body: JSON.stringify(");
    expect(jsonAsText).toContain(`body: '{"text":true}'`);
    expect(jsonAsText).not.toContain("JSON.stringify");
  });

  it("preserves whitespace-sensitive JSON payload bytes", () => {
    const bodyText = '{ "raw": true }';
    const output = generateFetch(
      spec({
        method: "POST",
        body: {
          kind: "raw",
          text: bodyText,
          contentType: "application/problem+json",
        },
      }),
    );
    const options = new Function(
      "fetch",
      `return ${output}`,
    )((_url: string, init: RequestInit) => init) as RequestInit;
    expect(options.body).toBe(bodyText);
    expect(output).not.toContain("JSON.stringify");
  });

  it("preserves a canonical JSON __proto__ property at runtime", () => {
    const bodyText = '{"__proto__":{"x":1}}';
    const output = generateFetch(
      spec({
        method: "POST",
        body: { kind: "json", text: bodyText },
      }),
    );
    const options = new Function(
      "fetch",
      `return ${output}`,
    )((_url: string, init: RequestInit) => init) as RequestInit;
    expect(options.body).toBe(bodyText);
  });

  it("omits an unsendable GET body", () => {
    expect(
      generateFetch(
        spec({
          body: { kind: "raw", text: "draft", contentType: "text/plain" },
        }),
      ),
    ).not.toContain("body:");
  });

  it("drops an empty manual Content-Type when the body supplies one", () => {
    const output = generateFetch(
      spec({
        method: "POST",
        headers: [
          {
            id: "ct",
            key: "content-type",
            value: "",
            enabled: true,
          },
        ],
        body: { kind: "json", text: '{"a":1}' },
      }),
    );
    const options = new Function(
      "fetch",
      `return ${output}`,
    )((_url: string, init: RequestInit) => init) as RequestInit;
    expect(new Headers(options.headers).get("content-type")).toBe(
      "application/json",
    );
  });
});
