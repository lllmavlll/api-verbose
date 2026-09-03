import { expect, it } from "vitest";

import { contentTypeOf, formatSize } from "./meta";

it("formats byte sizes human-readably", () => {
  expect(formatSize(512)).toBe("512 B");
  expect(formatSize(1400)).toMatch(/1\.4 KB/);
});

it("reads content-type case-insensitively", () => {
  expect(
    contentTypeOf([["Content-Type", "application/json; charset=utf-8"]]),
  ).toMatch(/application\/json/);
  expect(contentTypeOf([])).toBeUndefined();
});
