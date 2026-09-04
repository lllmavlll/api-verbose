# Project chronicle

Entries follow the `dev-chronicle` skill format, newest first.

## 03-09-2026 — Each response can prove the checks that matter ([#11](https://github.com/dev-mahesh-peerxp/api-verbose/issues/11))

- **What:** A developer can add status, JSONPath, and response-time rules in a dedicated Tests tab and see them run automatically against each completed response. The panel keeps rule order, explains actual versus expected failures, and turns invalid paths, non-JSON bodies, and failed sends into readable states instead of crashes.
- **Why:** Verbose needed lightweight, repeatable response checks without adding the scripting sandbox that the product deliberately excludes.
- **How it went:** The response seam exposed an encoded body union rather than the plan's convenience field, so the panel maps UTF-8 bodies into the pure evaluator and treats binary bodies as non-JSON. History provided stable request IDs for isolated replay snapshots; when the saved-request sibling landed before shipping, one final reconciliation advanced the shared Dexie schema and made explicit saves restore those same rule sets without duplicating storage.
- **Changed:** declarative status / JSONPath / response-time editor · automatic ordered pass/fail results · actual-versus-expected diagnostics · no-crash JSONPath errors · explicit not-run state · rule persistence across history replay and saved-request reopen · deterministic browser coverage
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/11-response-assertions-tests-panel

## 03-09-2026 — Complete requests can now live in local collections ([#9](https://github.com/dev-mahesh-peerxp/api-verbose/issues/9))

- **What:** A developer can explicitly name the complete request in the workbench, keep it Ungrouped or in a one-level collection, and open it later without sending. Saved requests and even empty collections survive reloads, with rename, move, and safe collection-delete choices available from the sidebar.
- **Why:** Automatic method-and-URL history covers quick recall, but developers also need deliberate, organized snapshots of fully configured requests for repeated work.
- **How it went:** The shared Dexie and Zustand seams from the earlier history and request-builder work fit cleanly. Dark mode landed while this branch was in flight, so the final pass rebased the new sidebar onto its theme-aware page shell and method colors; the privacy distinction stayed visible, with automatic history stripped of secrets and explicit saves clearly documented as complete snapshots.
- **Changed:** complete request snapshots in IndexedDB · Ungrouped and one-level collections · reload-surviving open without send · rename, move, and delete actions · default collection deletion moves requests to Ungrouped · explicit cascade choice · typed storage-failure feedback · browser coverage for the full lifecycle
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/9-saved-requests-local-collections

## 03-09-2026 — Verbose now feels at home in light and dark ([#12](https://github.com/dev-mahesh-peerxp/api-verbose/issues/12))

- **What:** Verbose now follows the browser's OS theme on a first visit and offers a visible Light, Dark, or System control. Explicit choices survive reloads, method colors remain readable in either palette, and an already-visible response re-highlights when the theme changes.
- **Why:** Developers needed a dark-first-quality interface that still respects their system and remains fully usable in light mode without a wrong-theme flash.
- **How it went:** Preflight caught that the original dark default contradicted the OS-light acceptance case, so the operator approved a system default before implementation. Browser testing then exposed a real hydration mismatch in the theme icon; a hydration-stable first render fixed it while preserving the pre-paint theme class.
- **Changed:** OS-aware first paint · Light/Dark/System menu · per-browser persistence · live OS tracking in System mode · two-theme method and Shiki tokens · response recoloring without re-send · hydration regression coverage
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/12-dark-mode-theming

## 03-09-2026 — Recent requests now survive a reload without saving secrets ([#8](https://github.com/dev-mahesh-peerxp/api-verbose/issues/8))

- **What:** Every resolved send now appears in a browser-local, searchable history that survives reloads and stays bounded at 500 entries. A developer can replay the method and URL without auto-sending, navigate recent requests from the URL field, export the log as JSON, or clear it after confirmation.
- **Why:** Verbose needed automatic recall for everyday request iteration and one shared IndexedDB foundation for later saved-request and assertion features.
- **How it went:** Implementation paused before the first code change because the original plan would have persisted the richer request model after headers, bodies, and credentials landed. The operator approved a replay-safe correction, so the shared Dexie foundation remained while automatic history was narrowed to method and URL plus non-sensitive result metadata.
- **Changed:** reload-surviving request history · newest-first method/URL search · replay that clears stale sensitive fields · URL-field arrow navigation · 500-entry cap · confirmed clear · JSON export · non-crashing storage-unavailable notice · deterministic browser coverage
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/8-local-persistence-history

## 03-09-2026 — Response metadata is now readable at a glance ([#7](https://github.com/dev-mahesh-peerxp/api-verbose/issues/7))

- **What:** Successful responses now include counted Headers and Cookies views alongside the body. Headers are sorted into a monospace name/value table, and visible Set-Cookie values become structured rows with their common attributes and flags.
- **Why:** Developers needed to inspect response metadata without decoding a raw header dump or mentally parsing cookie directives.
- **How it went:** The response renderer and required shadcn primitives had already landed on main, so the work composed around them instead of regenerating UI files. The parser needed explicit handling for folded cookie headers so an Expires date comma is never mistaken for a cookie boundary.
- **Changed:** counted response data tabs · sorted header rows · parsed cookie attributes · Max-Age precedence · relay-aware empty state · deterministic browser coverage
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/7-headers-cookies-tables

## 03-09-2026 — Requests can move cleanly between Verbose and code ([#10](https://github.com/dev-mahesh-peerxp/api-verbose/issues/10))

- **What:** Verbose can now import a supported curl command into the live request builder and report every unsupported flag it encounters. Developers can also copy the effective request as curl, JavaScript fetch, or Python requests code with target-correct escaping and a visible clipboard result.
- **Why:** Developers needed a plain-text bridge between an everyday terminal request and the request they inspect or refine in Verbose.
- **How it went:** The pure tokenizer, parser, and generators fit the shared request seam, but independent review caught that exact editor-model equality conflicts with runnable curl/fetch output for implicit body metadata and unsendable GET drafts. The operator approved effective-wire semantics, and the correction pass added target compilers, real keyboard coverage, proxy-flag arity, and failure-path regressions.
- **Changed:** curl quoting and supported-flag parsing · wire-equivalent whole-request import with inline errors and ignored-flag note · curl/fetch/Python generation selected by effective Content-Type · clipboard success and fallback messages · keyboard-ready shadcn dialog and menu · independent shell/JavaScript/Python syntax checks · import/export documentation
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/10-curl-import-copy-as-code

## 03-09-2026 — Every core request action is now at your fingertips ([#13](https://github.com/dev-mahesh-peerxp/api-verbose/issues/13))

- **What:** Verbose now has a searchable command palette and a shared keyboard-shortcut layer. A developer can choose a method, focus the URL, and send a request without reaching for the mouse, while a help dialog always reflects the commands currently available.
- **Why:** The app needed one discoverable keyboard system that core actions and future history, theme, and saved-request features can extend without duplicated handlers or dead commands.
- **How it went:** The current shadcn generator uses the repository's Base UI style. As the request builder, relay, and typed-body editor landed on main, the command layer was repeatedly reconciled with their Zustand-owned request state and composed send path. The final integration keeps CodeMirror's editor-aware key behavior while routing every send shortcut through the same validated form and body-capable transport path.
- **Changed:** Searchable ⌘K / Ctrl+K palette · global send and focus shortcuts · store-backed palette method switching · composed builder, typed-body, and relay-aware command send · discoverable shortcut help · optional command registrations for future sibling features · keyboard-only browser coverage
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/13-command-palette

## 03-09-2026 — Responses now read like typeset documents ([#6](https://github.com/dev-mahesh-peerxp/api-verbose/issues/6))

- **What:** Successful responses now open in a richer panel with theme-aware syntax highlighting, exact Raw text, safe HTML and image previews, content metadata, and redirect context. Large responses skip highlighting so the reading surface stays responsive.
- **Why:** Verbose is built around making API responses easier to read than a plain text dump, and the walking skeleton only had basic JSON formatting.
- **How it went:** The implementation stayed inside the existing response seam; Base UI's semantic disabled tabs needed a test adjustment, and a tiny ephemeral HTTP server made the redirect browser test deterministic without fabricating hop data.
- **Changed:** Shiki highlighting for JSON, HTML, and XML · Pretty/Raw/Preview tabs · script-free and network-blocked HTML sandbox · image blob previews · 1 MB highlighting cap · content type and encoding metadata · visible redirect chain · deterministic browser evidence
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/6-response-rendering

## 03-09-2026 — Requests can now carry the body a developer intends ([#5](https://github.com/dev-mahesh-peerxp/api-verbose/issues/5))

- **What:** Verbose now keeps separate in-session drafts for JSON, URL-encoded form, and raw request bodies. It sends the selected non-empty body only on body-capable methods, supplies the matching Content-Type unless an explicit header wins, and keeps malformed JSON sendable with a quiet warning.
- **Why:** The request builder needed payload editing to complete the everyday REST loop without weakening the existing request-composition or relay boundaries.
- **How it went:** The existing `RequestSpec` and relay body seam fit without reshaping; CodeMirror stayed inside a small client-only wrapper, and deterministic browser echoes replaced a flaky third-party test dependency while still asserting the exact body and headers leaving the browser.
- **Changed:** none/JSON/form/raw body selector · JSON language editor and raw text editor · ordered URL-encoded form rows · automatic Content-Type with explicit-header override · body-method note · invalid-JSON warning · editor-aware send shortcut
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/5-typed-request-bodies

## 03-09-2026 — A full request can be shaped before it is sent ([#4](https://github.com/dev-mahesh-peerxp/api-verbose/issues/4))

- **What:** Verbose now has editable query-parameter and header tables plus None, Bearer, Basic, and API-key auth presets. Query rows stay synchronized with the URL, auth collisions remain visible, and the fully composed request reaches the existing send path without storing credentials.
- **Why:** The walking skeleton could send only a method and URL; developers needed to construct the rest of a practical REST request while preserving the stable seam needed by later slices.
- **How it went:** The store and pure composition seams kept two-way URL sync predictable; review confirmed that browser Fetch may combine duplicate same-name headers on the wire, so the transport limit was made explicit while keeping the rows distinct in the request model. A delayed-hydration browser repro also caught early edits arriving before React handlers, so the builder now waits for hydration before accepting input.
- **Changed:** keyboard-friendly trailing rows · live URL and query-param sync · repeated headers and params · auth presets and collision notices · store-backed request composition · deterministic browser coverage · builder usage documentation
- **Decisions:** preserve duplicate header rows in `RequestSpec`; require physical repeated fields only on transports that support them

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/4-request-builder

## 03-09-2026 — CORS-blocked APIs now answer safely through the app ([#3](https://github.com/dev-mahesh-peerxp/api-verbose/issues/3))

- **What:** Verbose now retries failed idempotent browser requests through its in-app relay and marks those responses `via relay`. The relay rejects unsafe destinations, pins the actual Node connection to a validated public DNS address, rechecks redirects, and bounds time and response size without storing request data.
- **Why:** A browser-only REST client cannot read many real API responses because of CORS, but a server relay must not become a path into internal services or cloud metadata.
- **How it went:** The original Cloudflare/OpenNext plan could not close the DNS-rebinding window, so implementation paused for an architecture decision; after the operator chose one Node-compatible deployable, browser testing caught Node's multi-address lookup callback and GitHub's User-Agent requirement before hand-back.
- **Changed:** automatic relay fallback for safe methods · no silent retry for ambiguous POST/PATCH failures · pinned DNS egress with private/CGNAT/metadata blocking · redirect revalidation · size and timeout caps · request/response header hygiene · `via relay` response label · self-host security guidance
- **Decisions:** 03-09-2026 (dev-mahesh-peerxp) — Supersede the Cloudflare/OpenNext hosting direction with one Node-compatible Next.js deployable so the in-app CORS relay can pin each outbound connection to its validated DNS address while retaining Host/SNI; do not add a separate relay service.

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/3-cors-relay

## 02-09-2026 — The first request can travel end to end ([#2](https://github.com/dev-mahesh-peerxp/api-verbose/issues/2))

- **What:** Verbose now opens as a working REST client instead of an empty repository. A developer can choose a method, enter a URL, send a direct browser request, and read the status, timing, size, and formatted response without an account or saved data.
- **Why:** The project needed a runnable walking skeleton and a stable request seam before the relay and richer request-builder slices could build on it.
- **How it went:** The app and test stack came together cleanly; an unrelated app already occupied port 3000, so browser verification was isolated on port 3102 while the documented local server remains on 3000.
- **Changed:** Next.js and shadcn/ui scaffold · validated request bar and keyboard submit · direct-fetch request seam · idle/loading/success/error response states · deterministic unit and browser tests · local-run documentation
- **Decisions:** none

— approved by (dev-mahesh-peerxp) · built by Codex · branch feat/2-send-response-skeleton
