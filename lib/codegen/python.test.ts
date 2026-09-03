import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import type { RequestSpec } from "@/lib/http/types";

import { generatePython } from "./python";

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

describe("generatePython", () => {
  it("preserves JSON body bytes through data= and emits Basic auth", () => {
    const output = generatePython(
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
        auth: { kind: "basic", username: "a", password: "b" },
        body: { kind: "json", text: '{"a":1}' },
      }),
    );
    expect(output).toContain("import requests");
    expect(output).toContain("requests.request('POST', 'https://api.test/x'");
    expect(output).toContain("data='{\"a\":1}'");
    expect(output).toContain("auth=('a', 'b')");
  });

  it("uses data= for a non-JSON raw body", () => {
    const output = generatePython(
      spec({
        method: "POST",
        body: {
          kind: "raw",
          text: "a=1&b=2",
          contentType: "application/x-www-form-urlencoded",
        },
      }),
    );
    expect(output).toContain("data='a=1&b=2'");
    expect(output).not.toContain("json=");
  });

  it("omits body kwargs when there is no body", () => {
    const output = generatePython(spec());
    expect(output).not.toContain("json=");
    expect(output).not.toContain("data=");
  });

  it("falls back to data= for invalid JSON so the snippet stays runnable", () => {
    const output = generatePython(
      spec({ method: "POST", body: { kind: "json", text: "{broken" } }),
    );
    expect(output).toContain("data='{broken'");
    expect(output).not.toContain("json=");
  });

  it("escapes Python string literals", () => {
    const output = generatePython(
      spec({
        method: "POST",
        url: "https://api.test/it's",
        body: { kind: "raw", text: "one\ntwo\\three", contentType: "text/plain" },
      }),
    );
    expect(output).toContain("https://api.test/it\\'s");
    expect(output).toContain("data='one\\ntwo\\\\three'");
  });

  it("uses byte-faithful data= regardless of the effective Content-Type", () => {
    const rawJson = generatePython(
      spec({
        method: "POST",
        body: {
          kind: "raw",
          text: '{"raw":true}',
          contentType: "application/problem+json",
        },
      }),
    );
    const jsonAsText = generatePython(
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
    expect(rawJson).toContain(`data='{"raw":true}'`);
    expect(jsonAsText).toContain(`data='{\"text\":true}'`);
    expect(jsonAsText).not.toContain("json=");
  });

  it("executes with the whitespace-sensitive JSON payload unchanged", () => {
    const bodyText = '{ "raw": true }';
    const output = generatePython(
      spec({
        method: "POST",
        body: {
          kind: "raw",
          text: bodyText,
          contentType: "application/problem+json",
        },
      }),
    );
    const harness = [
      "import sys, types",
      "requests = types.ModuleType('requests')",
      `def request(method, url, **kwargs):\n    assert kwargs['data'] == ${JSON.stringify(bodyText)}`,
      "requests.request = request",
      "sys.modules['requests'] = requests",
      `exec(${JSON.stringify(output)})`,
    ].join("\n");
    const result = spawnSync("python3", ["-c", harness], {
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(output).not.toContain("json=");
  });

  it("omits an unsendable GET body", () => {
    expect(
      generatePython(
        spec({ body: { kind: "json", text: '{"draft":true}' } }),
      ),
    ).not.toContain("json=");
  });

  it("escapes source-invalid controls and passes Python compilation", () => {
    const output = generatePython(
      spec({
        method: "POST",
        body: {
          kind: "raw",
          text: "nul:\0 end",
          contentType: "text/plain",
        },
      }),
    );
    expect(output).toContain("nul:\\x00 end");
    const result = spawnSync(
      "python3",
      ["-c", "import sys; compile(sys.stdin.read(), '<generated>', 'exec')"],
      { encoding: "utf8", input: output },
    );
    expect(result.status, result.stderr).toBe(0);
  });

  it("applies effective auth and automatic Content-Type header rules", () => {
    const output = generatePython(
      spec({
        method: "POST",
        headers: [
          {
            id: "auth",
            key: "Authorization",
            value: "manual",
            enabled: true,
          },
          { id: "ct", key: "content-type", value: "", enabled: true },
        ],
        auth: { kind: "basic", username: "ada", password: "secret" },
        body: { kind: "json", text: '{"a":1}' },
      }),
    );
    expect(output).not.toContain("manual");
    expect(output).not.toContain("'content-type': ''");
    expect(output).toContain("'Content-Type': 'application/json'");
    expect(output).toContain("auth=('ada', 'secret')");
  });
});
