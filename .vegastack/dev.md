# Dev profile — dev-mahesh-peerxp/api-verbose

This file is the project's handbook and its only process document: short directional bullets, not prose. Skills read the section they need. When reality disagrees with a line, fix the line; when a gotcha or repeated instruction surfaces, fold ONE line into the right section — never append a log. A section left as TODO because its machinery didn't exist yet: re-run dev-setup detection when the machinery appears.

repo: dev-mahesh-peerxp/api-verbose · default branch main
stack: Next.js + TypeScript on a Node-compatible runtime (Tailwind, shadcn/ui components, Zustand, CodeMirror 6, Dexie/IndexedDB); the CORS relay is a Node-runtime Next.js Route Handler in the same deployable, no separate service. The `## Architecture` section carries the rest
commands: test `npm test` · build `npm run build` · dev `npm run dev`
authority: SOW.md → this file → skill defaults

## Knobs

review: cross-agent-risky   # subagent (never cross-agent) | cross-agent-risky (other agent on risky) | cross-agent (always) — dev-review maps these
ui-evidence: playwright     # playwright | none
evidence-repo: vegastack/agent-dev-review-evidence   # shared across projects; this project's folder = repo name; delete the line when ui-evidence is none
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

- start: `npm run dev` · http://localhost:3000
- Send loop: pick a method + URL, hit send (⌘↵), response renders with status/timing/size
- CORS path: a cross-origin request that browsers block falls back through the Next.js relay route handler and still returns
- Response view: JSON highlighted in code blocks; Headers / Cookies / Tests tabs populate
- Persistence: reload the page — history and saved requests survive (IndexedDB)

## Environments

- local dev: `npm run dev` (Next.js on :3000); the pinned-egress CORS relay is a Node-runtime Route Handler in the same app — no separate service to run
- production demo: TODO — public demo deploy target not chosen yet (see Architecture: hosting)
- Codex CLI present (cross-agent review enabled); SkillSpector not installed (not needed — skill-scan is none)
- Secrets: none server-side by design (local-first, no accounts); the relay needs no secrets. Env NAMES, if any appear, go in `.env.example` — values never in this file.

## Design

- Component system: **shadcn/ui** (Radix + Tailwind) for all UI components — reach for a shadcn primitive before hand-rolling one; extend via the generated component in `components/ui`, don't fork upstream
- Monospace-forward: a dev mono (e.g. JetBrains Mono) for all data/headers/status/code; a clean grotesk for UI chrome
- Method color-coding (GET/POST/PUT/PATCH/DELETE) consistent app-wide — as Tailwind/theme tokens, not per-component hex
- Dark mode first-class and default; respects OS preference; persisted per browser (shadcn theming)
- Keyboard-driven: ⌘K palette (shadcn Command), ⌘↵ send, ⌘\ focus URL, arrow-nav history

## Architecture

Facts dev-architect reads before advising — knobs, not prose. Decisions with rationale go
to the register, never here. The repo wins on drift; dev-architect proposes the one-line fix.

hosting: node-nextjs-single-deployable   # Provider remains TODO; the in-app relay requires Node DNS + HTTP(S) socket pinning. Confirm provider fit with dev-architect before first deploy.
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

- Open source, MIT — direct dependencies stay MIT/permissive; only the exact LGPL/MPL transitive packages recorded in `THIRD_PARTY_NOTICES.md` are exceptions, enforced by `npm run license:check`.
- UI components come from shadcn/ui — add via the shadcn CLI into `components/ui` and compose; only hand-roll when no primitive fits.
- Non-goals in SOW §02 are firm (no accounts/cloud sync, no WebSocket/GraphQL/gRPC, no scripting sandbox). Environments and collection files are the only sanctioned fast-follows.
- Local-first: no server-side persistence of user data; the relay route handler proxies, it never stores.
- Relay egress: resolve every target/redirect, reject any private/loopback/link-local/CGNAT/metadata answer, then pin Node HTTP(S) to one approved address while retaining Host/SNI; never replace this with resolve-then-unpinned-fetch.
