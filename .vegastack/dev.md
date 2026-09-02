# Dev profile — dev-mahesh-peerxp/api-verbose

This file is the project's handbook and its only process document: short directional bullets, not prose. Skills read the section they need. When reality disagrees with a line, fix the line; when a gotcha or repeated instruction surfaces, fold ONE line into the right section — never append a log. A section left as TODO because its machinery didn't exist yet: re-run dev-setup detection when the machinery appears.

repo: dev-mahesh-peerxp/api-verbose · default branch main
stack: React + Vite + TypeScript SPA (Tailwind, Zustand, CodeMirror 6, Dexie/IndexedDB) plus a tiny optional CORS relay; the `## Architecture` section carries the rest
commands: test `npm test` · build `npm run build` · dev `npm run dev`   # TODO confirm once package.json is scaffolded
authority: SOW.md → this file → skill defaults

## Knobs

review: cross-agent-risky   # subagent (never cross-agent) | cross-agent-risky (other agent on risky) | cross-agent (always) — dev-review maps these
ui-evidence: playwright     # playwright | none
evidence-repo: dev-mahesh-peerxp/dev-review-evidence   # shared across projects; this project's folder = repo name; delete the line when ui-evidence is none
gates: 2                    # 3 = approve/PR/merge · 2 = approve + one "ship it" · 1 = direct-to-main, ship word merges locally and pushes, no PR
tests: logic-only           # required | logic-only
skill-scan: none            # ONE line only — directory holding the agent skills to scan (the BUILT one where a bundle is generated) | none. dev-review's guard reads this and refuses if a second line gives a different value
merge: squash
branch: <type>/<issue>-<slug>   # type: feat | fix | docs | chore | refactor — the only place this list lives
labels: needs-operator needs-plan ready working for-operator risky research quick-build full-plan epic   # epic label marks map parents only where the org has no native Epic issue type
changelog: keep-a-changelog
decisions: .vegastack/decisions.md
release: on-request         # per-merge = Ship runbook runs as part of shipping · on-request = only when the operator says "release"
chronicle: on               # on = dev-implement writes a .vegastack/chronicle.md story entry per behavior-changing branch · off

## Ship — what happens after merge, in order

Line prefixes: `auto:` (agent just does it) · `ask:` (operator's word first) · `guard:` (deterministic check run locally at this position, its runnable command inline on the line; the CI copy is the backstop).

- auto: move the `[Unreleased]` changelog entries under a new dated version heading, commit as `chore: release <version>`
- guard: changelog has an entry for the version being released —
  `awk -v ver="$VERSION" '$0=="## "ver||index($0,"## ["ver"]")==1{i=1;next} i&&/^## /{exit} i&&/^\[.*\]:/{next} i{print}' CHANGELOG.md | grep -q '[^[:space:]]' || { echo "no changelog entry for $VERSION"; exit 1; }`
- ask: deploy to production   # TODO — no deploy pipeline yet; re-run dev-setup once the demo host + deploy command exist (see Architecture: hosting)
- auto: smoke-check the deployed URL against the Verify flows; report
- Rollback is redeploying the previous known-good build/revision via the platform; a code fix rolls forward through the normal flow.
- Releases are date-based (deploy-driven); the changelog heading is the version identity — no manifest version bump until the project decides to tag.

## Verify — how to see it working (pre-merge)

- start: `npm run dev` · http://localhost:5173   # TODO confirm port once Vite is scaffolded
- Send loop: pick a method + URL, hit send (⌘↵), response renders with status/timing/size
- CORS path: a cross-origin request that browsers block falls back through the relay and still returns
- Response view: JSON highlighted in code blocks; Headers / Cookies / Tests tabs populate
- Persistence: reload the page — history and saved requests survive (IndexedDB)

## Environments

- local dev: `npm run dev` (SPA); the CORS relay runs locally/self-hosted — one small serverless fn/Node proxy
- production demo: TODO — public demo deploy target not chosen yet
- Codex CLI present (cross-agent review enabled); SkillSpector not installed (not needed — skill-scan is none)
- Secrets: none server-side by design (local-first, no accounts); the relay needs no secrets. Env NAMES, if any appear, go in `.env.example` — values never in this file.

## Design

- Monospace-forward: a dev mono (e.g. JetBrains Mono) for all data/headers/status/code; a clean grotesk for UI chrome
- Method color-coding (GET/POST/PUT/PATCH/DELETE) consistent app-wide
- Dark mode first-class and default; respects OS preference; persisted per browser
- Keyboard-driven: ⌘K palette, ⌘↵ send, ⌘\ focus URL, arrow-nav history

## Architecture

Facts dev-architect reads before advising — knobs, not prose. Decisions with rationale go
to the register, never here. The repo wins on drift; dev-architect proposes the one-line fix.

hosting: TODO   # SPA (static) + a tiny CORS relay function; demo host not chosen. Consult dev-architect before picking.
database: none          # local-first; IndexedDB (Dexie) in the browser, no server DB
auth: none              # no accounts by design (SOW §02 non-goals)
storage: none           # IndexedDB is browser-side, not server object storage
jobs: none
agents: none
stage: pre-launch       # pre-launch = delete-not-migrate applies
kind: oss
mobile: no              # Tauri desktop is a stretch/fast-follow, not v1

## Decisions

Record a decision only when it is directional — it steers work beyond this issue: a real alternative was rejected; it constrains work not yet written; and no dev.md line, lint rule, or guard can enforce it instead (if one can, write the rule). Feature requests, one-off fixes, and routine implementation choices never qualify. Every entry needs the user's explicit yes. One line in the register (`decisions:` knob), append-only, no other metadata:

- DD-MM-YYYY (github-username) — the decision

## Stop and ask

Dark execution ends and the operator decides when work would involve: a change of scope or product behavior, a significant new dependency or runtime, spending money, anything destructive or touching production, or a blocker the brief cannot resolve. Nothing ships without the operator's explicit instruction — see the AGENTS.md dev section.

## Project rules

- Open source, MIT — keep all dependencies MIT/permissive.
- Non-goals in SOW §02 are firm (no accounts/cloud sync, no WebSocket/GraphQL/gRPC, no scripting sandbox). Environments and collection files are the only sanctioned fast-follows.
- Local-first: no server-side persistence of user data; the relay proxies, it never stores.
