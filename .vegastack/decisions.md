# Decision register — dev-mahesh-peerxp/api-verbose

Append-only. One line per directional decision, no other metadata:
`DD-MM-YYYY (github-username) — the decision`. Identity is the GitHub username
(`gh api user -q .login`, fallback `git config user.name`). See `.vegastack/dev.md` `## Decisions` for what qualifies.

- 02-09-2026 (dev-mahesh-peerxp) — The CORS relay is a Next.js Route Handler, never `proxy.ts`/Node middleware — OpenNext Cloudflare has no Node middleware (verified 2026-08); constrains #3 and any future request-interception work.
