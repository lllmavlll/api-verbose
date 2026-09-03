#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const PERMISSIVE_LICENSES = new Set([
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "Python-2.0",
]);

const LGPL_SHARP_PACKAGES = [
  "@img/sharp-libvips-darwin-arm64",
  "@img/sharp-libvips-darwin-x64",
  "@img/sharp-libvips-linux-arm",
  "@img/sharp-libvips-linux-arm64",
  "@img/sharp-libvips-linux-ppc64",
  "@img/sharp-libvips-linux-riscv64",
  "@img/sharp-libvips-linux-s390x",
  "@img/sharp-libvips-linux-x64",
  "@img/sharp-libvips-linuxmusl-arm64",
  "@img/sharp-libvips-linuxmusl-x64",
];

const MIXED_LICENSE_SHARP_PACKAGES = {
  "@img/sharp-wasm32": "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
  "@img/sharp-win32-arm64": "Apache-2.0 AND LGPL-3.0-or-later",
  "@img/sharp-win32-ia32": "Apache-2.0 AND LGPL-3.0-or-later",
  "@img/sharp-win32-x64": "Apache-2.0 AND LGPL-3.0-or-later",
};

const MPL_LIGHTNINGCSS_PACKAGES = [
  "lightningcss",
  "lightningcss-android-arm64",
  "lightningcss-darwin-arm64",
  "lightningcss-darwin-x64",
  "lightningcss-freebsd-x64",
  "lightningcss-linux-arm-gnueabihf",
  "lightningcss-linux-arm64-gnu",
  "lightningcss-linux-arm64-musl",
  "lightningcss-linux-x64-gnu",
  "lightningcss-linux-x64-musl",
  "lightningcss-win32-arm64-msvc",
  "lightningcss-win32-x64-msvc",
];

const APPROVED_TRANSITIVE_EXCEPTIONS = new Map([
  ...LGPL_SHARP_PACKAGES.map((name) => [
    name,
    {
      license: "LGPL-3.0-or-later",
      reason: "transitive platform image binary from Next.js sharp support",
    },
  ]),
  ...Object.entries(MIXED_LICENSE_SHARP_PACKAGES).map(([name, license]) => [
    name,
    {
      license,
      reason: "transitive platform image binary from Next.js sharp support",
    },
  ]),
  ...MPL_LIGHTNINGCSS_PACKAGES.map((name) => [
    name,
    {
      license: "MPL-2.0",
      reason: "transitive build-time CSS compiler from Tailwind and Vite",
    },
  ]),
  [
    "axe-core",
    {
      license: "MPL-2.0",
      reason: "transitive accessibility test engine from eslint-plugin-jsx-a11y",
    },
  ],
]);

function packageNameFromPath(packagePath) {
  const marker = "node_modules/";
  const index = packagePath.lastIndexOf(marker);
  return index === -1 ? packagePath : packagePath.slice(index + marker.length);
}

function permittedException(name, license) {
  const exception = APPROVED_TRANSITIVE_EXCEPTIONS.get(name);
  return exception?.license === license ? exception : undefined;
}

export function auditLockfile(lockfile) {
  const violations = [];
  const exceptions = [];
  const root = lockfile.packages?.[""] ?? {};
  const directDependencies = new Set([
    ...Object.keys(root.dependencies ?? {}),
    ...Object.keys(root.devDependencies ?? {}),
    ...Object.keys(root.optionalDependencies ?? {}),
  ]);

  for (const [packagePath, metadata] of Object.entries(lockfile.packages ?? {})) {
    if (!packagePath) continue;

    const name = packageNameFromPath(packagePath);
    const license = metadata.license;
    if (!license) {
      violations.push({ name, license: null, reason: "missing license metadata" });
      continue;
    }

    if (PERMISSIVE_LICENSES.has(license)) continue;

    const exception = permittedException(name, license);
    if (exception) {
      if (directDependencies.has(name)) {
        violations.push({
          name,
          license,
          reason: "approved only as a transitive dependency",
        });
        continue;
      }
      exceptions.push({ name, license, reason: exception.reason });
      continue;
    }

    violations.push({ name, license, reason: "license is not allowed" });
  }

  return { violations, exceptions };
}

async function main() {
  const lockfile = JSON.parse(await readFile("package-lock.json", "utf8"));
  const result = auditLockfile(lockfile);

  if (result.violations.length > 0) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(
    `License policy passed (${result.exceptions.length} reviewed transitive exceptions).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
