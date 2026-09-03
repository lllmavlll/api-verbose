import { describe, expect, it } from "vitest";

import { SHIKI_THEMES, shikiThemeFor } from "./shiki-theme";

describe("shikiThemeFor", () => {
  it("maps resolved light and dark themes", () => {
    expect(shikiThemeFor("light")).toBe(SHIKI_THEMES.light);
    expect(shikiThemeFor("dark")).toBe(SHIKI_THEMES.dark);
  });

  it("defaults to dark while the theme is unresolved", () => {
    expect(shikiThemeFor(undefined)).toBe(SHIKI_THEMES.dark);
  });
});
