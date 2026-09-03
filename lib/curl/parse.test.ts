import { describe, expect, it } from "vitest";

import { parseCurl } from "./parse";

function ok(input: string) {
  const result = parseCurl(input);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("parseCurl", () => {
  it("defaults to GET with a bare positional URL and imports query params", () => {
    const result = ok("curl https://api.test/x?a=1&a=2");
    expect(result.spec).toMatchObject({
      method: "GET",
      url: "https://api.test/x?a=1&a=2",
    });
    expect(result.spec.params.map(({ key, value }) => [key, value])).toEqual([
      ["a", "1"],
      ["a", "2"],
    ]);
  });

  it("accepts input without the leading curl token", () => {
    expect(ok("https://api.test/x").spec.method).toBe("GET");
  });

  it("lets an explicit request method win", () => {
    expect(ok("curl -X DELETE https://api.test/x -d x").spec.method).toBe(
      "DELETE",
    );
    expect(ok("curl --request PUT https://api.test/x").spec.method).toBe(
      "PUT",
    );
  });

  it("infers POST when a data flag is present without an explicit method", () => {
    expect(ok("curl https://api.test/x -d 'a=1'").spec.method).toBe("POST");
  });

  it("collects repeated headers and preserves their order", () => {
    const headers = ok(
      "curl https://api.test/x -H 'Accept: application/json' -H 'X-Env: dev'",
    ).spec.headers;

    expect(headers.map(({ key, value }) => [key, value])).toEqual([
      ["Accept", "application/json"],
      ["X-Env", "dev"],
    ]);
    expect(headers.every(({ enabled, id }) => enabled && id.length > 0)).toBe(
      true,
    );
  });

  it("joins repeated data values and applies curl's default content type", () => {
    expect(ok("curl https://api.test/x -d a=1 --data b=2").spec.body).toEqual({
      kind: "raw",
      text: "a=1&b=2",
      contentType: "application/x-www-form-urlencoded",
    });
  });

  it("uses a preserved explicit JSON Content-Type for a JSON body", () => {
    const spec = ok(
      `curl https://api.test/x -H 'Content-Type: application/problem+json' -d '{"a":1}'`,
    ).spec;

    expect(spec.body).toEqual({ kind: "json", text: '{"a":1}' });
    expect(spec.headers[0]).toMatchObject({
      key: "Content-Type",
      value: "application/problem+json",
    });
  });

  it("maps user credentials to Basic auth and accepts an empty password", () => {
    expect(ok("curl https://api.test/x -u alice:s3cret").spec.auth).toEqual({
      kind: "basic",
      username: "alice",
      password: "s3cret",
    });
    expect(ok("curl https://api.test/x -u alice").spec.auth).toEqual({
      kind: "basic",
      username: "alice",
      password: "",
    });
  });

  it("keeps an explicit Authorization header in the header table", () => {
    const spec = ok(
      "curl https://api.test/x -H 'Authorization: Basic Zm9vOmJhcg=='",
    ).spec;
    expect(spec.auth).toEqual({ kind: "none" });
    expect(spec.headers[0]).toMatchObject({
      key: "Authorization",
      value: "Basic Zm9vOmJhcg==",
    });
  });

  it("parses equals forms for long flags", () => {
    expect(
      ok("curl --url=https://api.test/x --request=PATCH").spec,
    ).toMatchObject({ url: "https://api.test/x", method: "PATCH" });
  });

  it("collects unsupported flags and consumes their values", () => {
    const result = ok(
      "curl --compressed -k --cookie foo=bar -F avatar=@me.png -o out https://api.test/x",
    );
    expect(result.ignored).toEqual([
      "--compressed",
      "-k",
      "--cookie",
      "-F",
      "-o",
    ]);
    expect(result.spec.url).toBe("https://api.test/x");
  });

  it.each([
    ["--proxy-header", "X-Proxy: y"],
    ["--proxy-cacert", "/tmp/proxy.pem"],
    ["--preproxy", "socks5://proxy.test"],
  ])("ignores value-taking proxy flag %s without consuming the URL", (flag, value) => {
    const result = ok(`curl ${flag} '${value}' https://api.test/x`);
    expect(result.ignored).toEqual([flag]);
    expect(result.spec.url).toBe("https://api.test/x");
  });

  it("ignores equals-form proxy flags without consuming the URL", () => {
    const result = ok(
      "curl --proxy-header='X-Proxy: y' https://api.test/x",
    );
    expect(result.ignored).toEqual(["--proxy-header"]);
    expect(result.spec.url).toBe("https://api.test/x");
  });

  it.each([
    "--proxy1.0",
    "--proxy-pinnedpubkey",
    "--socks5-gssapi-service",
    "--haproxy-clientip",
  ])("consumes every remaining proxy-family value for %s", (flag) => {
    const result = parseCurl(
      `curl ${flag} proxy-value https://api.test/x`,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.url).toBe("https://api.test/x");
      expect(result.ignored).toContain(flag);
    }
  });

  it("reports file-backed binary data as ignored", () => {
    const result = ok(
      "curl https://api.test/x --data-binary @payload.json",
    );
    expect(result.ignored).toEqual(["--data-binary"]);
    expect(result.spec.body).toEqual({ kind: "none" });
  });

  it("returns clear errors for malformed or incomplete input", () => {
    expect(parseCurl("curl https://api.test/x -H 'Accept: text")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/unterminated quote/i),
    });
    expect(parseCurl("   ")).toMatchObject({ ok: false });
    expect(parseCurl("curl -X POST")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/url/i),
    });
  });

  it("rejects methods outside the shared request model", () => {
    expect(parseCurl("curl -X TRACE https://api.test/x")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/unsupported.*trace/i),
    });
  });
});
