import { describe, expect, it } from "vitest";

import { tokenize } from "./tokenize";

describe("tokenize", () => {
  it("splits on unquoted whitespace", () => {
    expect(tokenize("curl -X POST https://api.test/x")).toEqual([
      "curl",
      "-X",
      "POST",
      "https://api.test/x",
    ]);
  });

  it("keeps single-quoted content verbatim", () => {
    expect(tokenize("curl -H 'Accept: application/json'")).toEqual([
      "curl",
      "-H",
      "Accept: application/json",
    ]);
  });

  it("applies backslash escapes inside double quotes", () => {
    expect(tokenize('curl -d "a=\\"1\\""')).toEqual([
      "curl",
      "-d",
      'a="1"',
    ]);
  });

  it("honors backslash escapes outside quotes", () => {
    expect(tokenize(String.raw`curl -H X-Note:\ hello`)).toEqual([
      "curl",
      "-H",
      "X-Note: hello",
    ]);
  });

  it("folds a backslash-newline line continuation", () => {
    expect(tokenize("curl https://api.test/x \\\n  -H 'A: b'")).toEqual([
      "curl",
      "https://api.test/x",
      "-H",
      "A: b",
    ]);
  });

  it("decodes common escapes in an ANSI-C string", () => {
    expect(tokenize("curl -d $'a\\nb\\tc\\'d\\\\e'")).toEqual([
      "curl",
      "-d",
      "a\nb\tc'd\\e",
    ]);
  });

  it("preserves empty quoted arguments", () => {
    expect(tokenize("curl -u '' https://api.test/x")).toEqual([
      "curl",
      "-u",
      "",
      "https://api.test/x",
    ]);
  });

  it("throws on an unterminated quote", () => {
    expect(() => tokenize("curl -H 'Accept: text")).toThrow(
      /unterminated quote/i,
    );
  });
});
