import { describe, expect, it } from "vitest";

import type { RequestSpec } from "@/lib/http/types";

import { codegens, generate } from "./index";

const spec: RequestSpec = {
  method: "GET",
  url: "https://api.test/x",
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
};

describe("codegen registry", () => {
  it("exposes the three targets in order with labels", () => {
    expect(codegens.map(({ id }) => id)).toEqual(["curl", "fetch", "python"]);
    expect(codegens.map(({ label }) => label)).toEqual([
      "curl",
      "fetch (JS)",
      "Python (requests)",
    ]);
  });

  it("dispatches to the selected generator", () => {
    expect(generate("curl", spec)).toMatch(/^curl /);
    expect(generate("fetch", spec)).toMatch(/^fetch\(/);
    expect(generate("python", spec)).toContain("import requests");
  });
});
