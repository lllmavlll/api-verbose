# Project chronicle

Entries follow the `dev-chronicle` skill format, newest first.

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
