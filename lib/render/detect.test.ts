import { expect, it } from "vitest";

import {
  HIGHLIGHT_CAP_BYTES,
  detectGrammar,
  detectPreview,
  isBinary,
  shouldHighlight,
} from "./detect";

it("maps content-type to a grammar, ignoring charset", () => {
  expect(detectGrammar("application/json; charset=utf-8", "{}")).toBe("json");
  expect(detectGrammar("text/html", "<p>")).toBe("html");
  expect(detectGrammar("application/xml", "<x/>")).toBe("xml");
  expect(detectGrammar("model/xml", "<x/>")).toBe("xml");
  expect(detectGrammar("text/plain", "hi")).toBe("text");
});

it("falls back to json when the body parses as JSON despite the type", () => {
  expect(detectGrammar("text/plain", '{"a":1}')).toBe("json");
  expect(detectGrammar(undefined, "not json")).toBe("text");
});

it("offers preview only for html and images", () => {
  expect(detectPreview("text/html; charset=utf-8")).toBe("html");
  expect(detectPreview("image/png")).toBe("image");
  expect(detectPreview("application/json")).toBe(null);
});

it("caps highlighting at the byte threshold", () => {
  expect(shouldHighlight(1024, "json")).toBe(true);
  expect(shouldHighlight(HIGHLIGHT_CAP_BYTES, "json")).toBe(false);
  expect(shouldHighlight(HIGHLIGHT_CAP_BYTES + 1, "json")).toBe(false);
});

it("flags binary content types", () => {
  expect(isBinary("application/octet-stream")).toBe(true);
  expect(isBinary("model/xml")).toBe(false);
  expect(isBinary("image/png")).toBe(false);
  expect(isBinary("application/json")).toBe(false);
});
