import { expect, it } from "vitest";

import { formatBody } from "./format-body";

it("pretty-prints JSON with two-space indentation", () => {
  expect(formatBody('{"a":1}', true)).toBe('{\n  "a": 1\n}');
});

it("leaves non-JSON untouched", () => {
  expect(formatBody("hello", false)).toBe("hello");
});

it("falls back to raw text when pretty-printing fails", () => {
  expect(formatBody("{bad", true)).toBe("{bad");
});

it("leaves JSON over the display threshold untouched", () => {
  const body = `{"value":"${"x".repeat(1024 * 1024)}"}`;

  expect(formatBody(body, true)).toBe(body);
});
