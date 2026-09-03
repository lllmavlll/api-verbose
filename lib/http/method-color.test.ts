import { describe, expect, it } from "vitest";

import { methodColorClass } from "./method-color";

describe("methodColorClass", () => {
  it.each([
    ["GET", "text-method-get"],
    ["POST", "text-method-post"],
    ["PUT", "text-method-put"],
    ["PATCH", "text-method-patch"],
    ["DELETE", "text-method-delete"],
  ] as const)("maps %s to its semantic theme token", (method, className) => {
    expect(methodColorClass(method)).toBe(className);
  });

  it.each(["HEAD", "OPTIONS"] as const)(
    "uses a neutral token for %s",
    (method) => {
      expect(methodColorClass(method)).toBe("text-muted-foreground");
    },
  );

  it("never returns a raw color", () => {
    for (const method of [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
    ] as const) {
      expect(methodColorClass(method)).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
});
