# Project chronicle

Entries follow the `dev-chronicle` skill format, newest first.

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
