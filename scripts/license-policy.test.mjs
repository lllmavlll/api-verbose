import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { auditLockfile } from "./check-licenses.mjs";

function lockfile(packages) {
  return { lockfileVersion: 3, packages: { "": {}, ...packages } };
}

describe("license policy", () => {
  it("accepts permissive packages and the exact approved transitive exceptions", () => {
    const result = auditLockfile(
      lockfile({
        "node_modules/ordinary": { license: "MIT" },
        "node_modules/@img/sharp-libvips-linux-x64": {
          license: "LGPL-3.0-or-later",
        },
        "node_modules/lightningcss": { license: "MPL-2.0" },
        "node_modules/lightningcss-linux-x64-gnu": { license: "MPL-2.0" },
        "node_modules/axe-core": { license: "MPL-2.0" },
      }),
    );

    expect(result.violations).toEqual([]);
    expect(result.exceptions).toHaveLength(4);
  });

  it("rejects weak-copyleft packages outside the named exception", () => {
    const result = auditLockfile(
      lockfile({
        "node_modules/unapproved": { license: "MPL-2.0" },
      }),
    );

    expect(result.violations).toEqual([
      {
        license: "MPL-2.0",
        name: "unapproved",
        reason: "license is not allowed",
      },
    ]);
  });

  it.each([
    ["lightningcss-unapproved", "MPL-2.0"],
    ["@img/sharp-unapproved", "LGPL-3.0-or-later"],
  ])("rejects lookalike package %s", (name, license) => {
    const result = auditLockfile(
      lockfile({ [`node_modules/${name}`]: { license } }),
    );

    expect(result.violations).toEqual([
      { name, license, reason: "license is not allowed" },
    ]);
  });

  it("rejects an approved exception when it becomes a direct dependency", () => {
    const result = auditLockfile({
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { lightningcss: "1.32.0" } },
        "node_modules/lightningcss": { license: "MPL-2.0" },
      },
    });

    expect(result.violations).toEqual([
      {
        name: "lightningcss",
        license: "MPL-2.0",
        reason: "approved only as a transitive dependency",
      },
    ]);
  });

  it("rejects packages without declared license metadata", () => {
    const result = auditLockfile(
      lockfile({ "node_modules/unknown": { version: "1.0.0" } }),
    );

    expect(result.violations[0]).toMatchObject({
      name: "unknown",
      reason: "missing license metadata",
    });
  });

  it("accepts the checked-in dependency graph", async () => {
    const lockfile = JSON.parse(await readFile("package-lock.json", "utf8"));
    const result = auditLockfile(lockfile);

    expect(result.violations).toEqual([]);
    expect(result.exceptions.length).toBeGreaterThan(0);
  });
});
