# Decision register — dev-mahesh-peerxp/api-verbose

Append-only. One line per directional decision, no other metadata:
`DD-MM-YYYY (github-username) — the decision`. Identity is the GitHub username
(`gh api user -q .login`, fallback `git config user.name`). See `.vegastack/dev.md` `## Decisions` for what qualifies.

- 02-09-2026 (dev-mahesh-peerxp) — The CORS relay is a Next.js Route Handler, never `proxy.ts`/Node middleware — OpenNext Cloudflare has no Node middleware (verified 2026-08); constrains #3 and any future request-interception work.
- 03-09-2026 (dev-mahesh-peerxp) — Allow only the named LGPL/MPL transitive exceptions required by the approved Next.js/Tailwind/Vitest toolchain, with compliance obligations documented and a deterministic license allowlist enforced.
- 03-09-2026 (dev-mahesh-peerxp) — Supersede the Cloudflare/OpenNext hosting direction with one Node-compatible Next.js deployable so the in-app CORS relay can pin each outbound connection to its validated DNS address while retaining Host/SNI; do not add a separate relay service.
