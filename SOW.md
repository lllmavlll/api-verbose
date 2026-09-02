# Statement of Work —  API Verbose

> **Verbose** — an open-source, local-first REST client that stays out of your way.
> A single-page API workbench for testing REST endpoints, reading responses like
> they're rendered in your editor, and running quick assertions — no account, no cloud.

| | |
|---|---|
| **Project** | API-Verbose *(working name)* |
| **Type** | Open source · MIT |
| **Prepared** | 2026-09-02 |
| **Author** | mahesh.kn@vegastack.com |
| **Status** | v0.1 draft |

---

## 01 · Overview & Objective

Build a fun, modern, keyboard-driven web app for testing REST endpoints — a
lightweight alternative to Postman that runs entirely in the browser and treats the
response as a first-class, beautifully typeset document.

Postman and its peers have grown heavy, login-walled, and cloud-first. Developers
increasingly reach for local-first tools (Hoppscotch, Bruno, Insomnia) precisely to
escape that. **Verbose** targets the fast, everyday loop: paste a URL, pick a method,
hit send, and read a response that's syntax-highlighted, timed, and rendered in clean
monospace — no sign-up between you and the request.

The differentiator is **presentation**: response bodies, headers, cookies, and test
results are laid out in a Markdown-style, code-block aesthetic with monospaced type
throughout — so scanning a payload feels like reading well-formatted docs, not
squinting at a raw dump.

---

## 02 · Goals & Non-Goals

### In scope — v1.0

- All HTTP methods with typed request bodies (**JSON, form, raw**)
- Custom headers, query params, and **auth helpers** (Bearer, Basic, API-key)
- Rich response: **status, timing breakdown, size, headers, cookies**
- **Markdown-style** response rendering with syntax highlighting
- **Response assertions / tests** *(explicitly requested)*
- **Dark mode + keyboard-driven UX** *(explicitly requested)*
- Local **request history** & saved requests (IndexedDB)
- **curl import** and **copy-as-code** (curl, fetch, Python)

### Non-goals — v1.0

- Accounts, cloud sync, or team workspaces
- Cloud-hosted collections or sharing servers
- WebSocket / GraphQL / gRPC protocols
- Mock servers & API monitoring
- Scripting sandbox (pre/post-request JS)
- Native mobile apps
- Environment variables *(fast-follow — see §04)*

---

## 03 · The Architecture Decision to Make First

> ⚠️ **CORS** — one choice shapes the entire build.

A pure single-page app runs into **CORS**: browsers block cross-origin requests to
most real APIs, and JavaScript can't read low-level timing or arbitrary response
headers. A "just static HTML" tool would fail against a large share of endpoints.

**Recommendation:** ship the SPA as the product *plus* a tiny optional relay — a
~50-line serverless function / Node proxy the user can self-host or run locally.
Requests default to direct (browser) and fall back to the relay when CORS blocks
them. This keeps it "single-page + one small file," stays fully open-source and
self-hostable, and unlocks true timing + full headers.

A desktop shell (**Tauri**) is the alternative that removes CORS entirely and enables
real socket-level timing — noted as a stretch/fast-follow path in §06, kept out of v1
to protect the "open a URL and go" simplicity.

---

## 04 · Feature Scope

Tags: `REQUESTED` = explicitly asked for · `CORE` = essential to a usable v1 ·
`FAST-FOLLOW` = right after launch.

| Feature | What it does | Release |
|---|---|---|
| Request builder | URL bar, method picker, params/headers/body tables, auth presets (Bearer, Basic, API-key) | `CORE` |
| Response viewer | Status + meaning, timing breakdown, body/header size, pretty/raw/preview toggle | `CORE` |
| Markdown-style rendering | Syntax-highlighted JSON in code blocks, inline-code chips, monospace headers & cookies tables | `REQUESTED` |
| Response assertions | Per-request test rules: status equals, JSON-path equals, response-time < N ms — pass/fail panel | `REQUESTED` |
| Dark mode + shortcuts | Theme toggle, command palette (⌘K), ⌘↵ to send, keyboard nav across panels | `REQUESTED` |
| History | Auto-saved log of every request, searchable, one-click replay | `CORE` |
| Saved requests | Name & organize requests into local collections | `CORE` |
| curl import / export | Paste a curl command to populate a request; copy any request as curl / fetch / Python | `CORE` |
| Cookies & redirects | Parsed `Set-Cookie` table; visible redirect chain | `CORE` |
| Environments | `{{base_url}}` / `{{token}}` variables, swappable dev/staging/prod | `FAST-FOLLOW` |
| Collection files | Export/import collections as git-friendly JSON | `FAST-FOLLOW` |

### The signature response view

The response panel is the heart of the product. Body renders as a syntax-highlighted
code block; headers and cookies as monospace tables; a status/timing bar sits on top.

```
GET /v2/users/42        200 OK · 128 ms · 1.4 KB · gzip
[ Body ] [ Headers 14 ] [ Cookies 2 ] [ Tests ]

{
  "id": 42,
  "name": "Ada Lovelace",
  "active": true,
  "roles": ["admin", "editor"],
  "created_at": "2026-08-14T09:31:00Z"
}
// 7 lines · JSONPath: $.roles[0] → "admin"
```

### Assertions, in the same aesthetic

Assertions run automatically after each send and surface as a compact pass/fail list —
the kind of quick contract check developers reach for constantly.

```
Tests · 3 passed · 1 failed

✓ PASS  status == 200
✓ PASS  responseTime < 500 ms   (128 ms)
✓ PASS  $.name == "Ada Lovelace"
✗ FAIL  $.roles contains "owner" — got ["admin","editor"]
```

---

## 05 · UX & Visual Direction

Fun, modern, and fast — an interface that feels like a well-built code editor, not an
enterprise console.

- **Monospace-forward.** A dev mono (e.g. JetBrains Mono) for all data, headers,
  status, and code blocks; a clean grotesk for UI chrome and prose.
- **Method color-coding.** GET / POST / PUT / PATCH / DELETE carry consistent semantic
  colors across the whole app — instant visual parsing.
- **Keyboard-driven.** `⌘K` command palette, `⌘↵` to send, `⌘\` to focus URL,
  arrow-nav through history — mouse optional.
- **Dark & light themes.** First-class dark mode (default for this audience),
  persisted per browser, respects OS preference.
- **Snappy micro-interactions.** Send-button pulse, a live timer while in-flight,
  smooth panel transitions — playful but never in the way.
- **Local-first & instant.** Everything persists in the browser; no spinner waiting on
  a backend to save your work.

---

## 06 · Recommended Stack

Boring where it can be, modern where it counts. Swap freely — nothing here is
load-bearing except the CORS relay decision from §03.

| Layer | Choice | Role |
|---|---|---|
| App + build | React + Vite | UI and dev/build tooling |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS | Utility-first styles |
| State | Zustand | Lightweight store |
| Body editor | CodeMirror 6 | Request body editing + highlight |
| Storage | Dexie (IndexedDB) | History / saved requests |
| Response color | Shiki | Syntax highlighting |
| CORS relay | Node / serverless fn | Proxy for blocked requests |
| Desktop (stretch) | Tauri | Removes CORS, native timing |

JSON-path evaluation for assertions via a small library (e.g. `jsonpath-plus`);
code-snippet generation via a curl-parse/generate helper. All dependencies
MIT/permissive to keep the project cleanly OSS.

---

## 07 · Delivery Plan

Four phases, each ending in something usable. Durations are indicative for a solo
build and compress with more hands.

### Phase 1 — Send & see *(~1 week)*
The core loop: request builder, method + body, fire a request, render pretty JSON with
status and timing. The CORS relay proven end-to-end.
**Ships:** request builder · response viewer · timing/size · CORS relay

### Phase 2 — Read it beautifully *(~1 week)*
The signature presentation layer: Markdown-style rendering, syntax highlighting,
headers/cookies tables, redirect chain, raw/pretty/preview toggles.
**Ships:** markdown render · highlighting · headers table · cookies

### Phase 3 — Make it a tool *(~1 week)*
Persistence and power: history, saved requests, curl import, copy-as-code, auth
presets. IndexedDB wired up.
**Ships:** history · saved requests · curl import · copy-as-code

### Phase 4 — Fun & finished *(~1 week)*
The requested polish: assertions/tests panel, dark mode, command palette + shortcuts,
micro-interactions. Docs, MIT license, and a public demo deploy.
**Ships:** assertions · dark mode · ⌘K palette · demo + README

---

## 08 · Definition of Done

v1.0 ships when all of the following are true:

- [ ] **Any method, any endpoint** — sends GET–DELETE with typed bodies; CORS-blocked calls succeed via the relay.
- [ ] **Response reads like docs** — JSON is highlighted in code blocks; headers & cookies in monospace tables.
- [ ] **Assertions run** — status / JSON-path / response-time checks show a live pass-fail panel.
- [ ] **Keyboard-complete** — a full request can be built and sent without touching the mouse; dark mode persists.
- [ ] **Nothing is lost** — history and saved requests survive reload with zero backend.
- [ ] **Open & runnable** — MIT-licensed, one-command local run, live public demo, honest README.

---

## 09 · Risks & Assumptions

| Severity | Risk | Mitigation |
|---|---|---|
| **High** | CORS blocks real-world testing | Optional relay (§03); Tauri desktop as the escape hatch if the relay proves insufficient. |
| **Med** | Scope creep toward "full Postman" | Non-goals in §02 are firm; environments and collection files are the only sanctioned fast-follows. |
| **Med** | Large responses hurt render performance | Virtualize / truncate huge bodies with a "show raw" fallback; cap syntax highlighting past a size threshold. |
| **Low** | Browser storage limits for history | IndexedDB is generous; add a history cap + clear/export controls. |

**Assumptions:** solo or small-team build; open-source from day one; no server-side
persistence of user data; users are developers comfortable self-hosting the relay if
needed.
