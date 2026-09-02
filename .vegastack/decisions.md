# Decision register — dev-mahesh-peerxp/api-verbose

Append-only. One line per directional decision, no other metadata:
`DD-MM-YYYY (github-username) — the decision`. Identity is the GitHub username
(`gh api user -q .login`, fallback `git config user.name`). See `.vegastack/dev.md` `## Decisions` for what qualifies.
