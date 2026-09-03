import { describe, expect, it } from "vitest";

import { isAbsoluteHttpUrl } from "./url";

describe("isAbsoluteHttpUrl", () => {
  it.each(["http://api.test", "https://api.test/path"])(
    "accepts %s",
    (value) => {
      expect(isAbsoluteHttpUrl(value)).toBe(true);
    },
  );

  it.each([
    "",
    "/relative",
    "file:///tmp/test",
    "not a url",
    "https://api.test/path?a=%",
  ])(
    "rejects %s",
    (value) => {
      expect(isAbsoluteHttpUrl(value)).toBe(false);
    },
  );
});
