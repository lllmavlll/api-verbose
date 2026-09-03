import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("theme tokens", () => {
  it("declares a dark theme selector", () => {
    expect(css).toMatch(/\.dark\s*\{/);
  });

  it("exposes method tokens through Tailwind's inline theme", () => {
    expect(css).toMatch(/@theme\s+inline/);
    expect(css).toContain("--color-method-get: var(--method-get)");
    expect(css).toContain("--color-method-delete: var(--method-delete)");
  });

  it("does not create custom HEAD or OPTIONS color tokens", () => {
    expect(css).not.toContain("--method-head");
    expect(css).not.toContain("--method-options");
  });
});
