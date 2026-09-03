import { expect, it } from "vitest";

import {
  isImageMediaType,
  isJsonMediaType,
  isSvgMediaType,
  isTextualMediaType,
  isXmlMediaType,
  normalizeMediaType,
} from "./media-type";

it("normalizes parameters, whitespace, and case", () => {
  expect(normalizeMediaType(" Image/SVG+XML ; charset=utf-8")).toBe(
    "image/svg+xml",
  );
});

it("owns the shared JSON and XML media predicates", () => {
  expect(isJsonMediaType("application/json")).toBe(true);
  expect(isJsonMediaType("application/problem+json; charset=utf-8")).toBe(true);
  expect(isJsonMediaType("application/json-seq")).toBe(false);
  expect(isXmlMediaType("model/xml; charset=utf-8")).toBe(true);
  expect(isXmlMediaType("image/svg+xml")).toBe(true);
});

it("owns image, SVG, and textual media predicates", () => {
  expect(isImageMediaType("IMAGE/PNG")).toBe(true);
  expect(isSvgMediaType("image/svg+xml; charset=utf-8")).toBe(true);
  expect(isTextualMediaType("model/xml")).toBe(true);
  expect(isTextualMediaType("application/octet-stream")).toBe(false);
});
