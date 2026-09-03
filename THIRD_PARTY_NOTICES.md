# Third-party notices

Verbose is MIT-licensed. Its direct dependencies must remain permissively
licensed. The operator has approved only the exact weak-copyleft transitive
packages below because they are required by the selected Next.js, Tailwind,
Vitest, and Next.js ESLint toolchain. `npm run license:check` enforces the names,
declared licenses, transitive-only status, and the rest of the permissive-only
policy.

This file is an operational compliance checklist, not legal advice. The license
texts control. Re-check the dependency graph and shipped artifact before every
distribution or deployment.

## MPL-2.0 exceptions

- `axe-core`
- `lightningcss`
- `lightningcss-android-arm64`
- `lightningcss-darwin-arm64`
- `lightningcss-darwin-x64`
- `lightningcss-freebsd-x64`
- `lightningcss-linux-arm-gnueabihf`
- `lightningcss-linux-arm64-gnu`
- `lightningcss-linux-arm64-musl`
- `lightningcss-linux-x64-gnu`
- `lightningcss-linux-x64-musl`
- `lightningcss-win32-arm64-msvc`
- `lightningcss-win32-x64-msvc`

Source and license: [axe-core](https://github.com/dequelabs/axe-core),
[Lightning CSS](https://github.com/parcel-bundler/lightningcss), and the
[Mozilla Public License 2.0](https://www.mozilla.org/MPL/2.0/).

If an artifact containing MPL-covered software is distributed, tell recipients
where to obtain the MPL license and the corresponding covered source. Keep
modifications to MPL-covered files available under MPL-2.0. Unmodified,
build-time-only packages do not change Verbose's MIT license, but the release
check must establish whether they are included in the distributed artifact.

## LGPL-3.0-or-later exceptions

- `@img/sharp-libvips-darwin-arm64`
- `@img/sharp-libvips-darwin-x64`
- `@img/sharp-libvips-linux-arm`
- `@img/sharp-libvips-linux-arm64`
- `@img/sharp-libvips-linux-ppc64`
- `@img/sharp-libvips-linux-riscv64`
- `@img/sharp-libvips-linux-s390x`
- `@img/sharp-libvips-linux-x64`
- `@img/sharp-libvips-linuxmusl-arm64`
- `@img/sharp-libvips-linuxmusl-x64`
- `@img/sharp-wasm32` (`Apache-2.0 AND LGPL-3.0-or-later AND MIT`)
- `@img/sharp-win32-arm64` (`Apache-2.0 AND LGPL-3.0-or-later`)
- `@img/sharp-win32-ia32` (`Apache-2.0 AND LGPL-3.0-or-later`)
- `@img/sharp-win32-x64` (`Apache-2.0 AND LGPL-3.0-or-later`)

Source and license: [sharp](https://github.com/lovell/sharp),
[libvips](https://github.com/libvips/libvips), and the
[GNU Lesser General Public License 3.0](https://www.gnu.org/licenses/lgpl-3.0.html).

If an artifact containing LGPL-covered software is distributed, retain the
applicable notices and license, provide the covered Corresponding Source as the
license requires, and do not prohibit reverse engineering for debugging
modifications. Where the distribution is a combined work, preserve the user's
ability to replace or relink the LGPL component and provide installation
information when the license requires it. We currently ship these packages
unmodified; any modification requires a fresh compliance review.

## Release checklist

1. Run `npm run license:check` and investigate every new name or license.
2. Inspect the production artifact to identify which exceptions it actually
   contains; build/test-only packages do not need to be represented as shipped.
3. Include this notice and the applicable full license texts with any artifact
   that contains covered software.
4. Publish or point recipients to the exact covered source for distributed
   MPL/LGPL components and any modifications.
5. Escalate any direct weak-copyleft dependency, changed covered source, static
   linkage, or new distribution format for a fresh operator and legal review.
