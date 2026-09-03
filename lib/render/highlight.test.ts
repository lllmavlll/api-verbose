import { expect, it } from "vitest";

import { formatForGrammar, highlightToHtml } from "./highlight";

it("reindents JSON to two spaces for Pretty", () => {
  expect(formatForGrammar('{"a":1}', "json")).toBe('{\n  "a": 1\n}');
});

it("returns XML/HTML unchanged without reflow", () => {
  expect(formatForGrammar("<a><b/></a>", "xml")).toBe("<a><b/></a>");
});

it("leaves malformed JSON raw", () => {
  expect(formatForGrammar("{bad", "json")).toBe("{bad");
});

it("produces a shiki pre for the requested theme", async () => {
  const light = await highlightToHtml('{"a":1}', "json", "light");
  const dark = await highlightToHtml('{"a":1}', "json", "dark");

  expect(light).toMatch(/<pre[^>]*class="[^"]*shiki/);
  expect(light).toContain('"a"');
  expect(dark).not.toBe(light);
});

it("escapes plain text without tokenizing", async () => {
  const html = await highlightToHtml("<not-tokenized>", "text", "dark");

  expect(html).toContain("&lt;not-tokenized&gt;");
});
