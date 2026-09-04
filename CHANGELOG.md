# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- A sticky app header with an icon-only tap-to-cycle theme control, a sticky desktop Saved Requests rail, reliably applied Geist typography, warmer light surfaces, and higher-contrast Pretty responses.
- MIT license and an honest README with real local screenshots, setup instructions, and Node-compatible self-hosting guidance.
- Save complete requests explicitly and organize them into browser-local collections that persist in IndexedDB.
- Dark/light/system theming with an OS-aware first visit, persisted toggle, and theme-aware response highlighting.
- Response assertions: per-request status / JSONPath / response-time rules with an auto-run pass/fail panel and browser-local persistence across history replay and explicit saved requests.
- Request history persisted to IndexedDB (Dexie) — searchable by method and URL, one-click replay, capped at 500 entries, with clear and JSON export; automatic history stores no credentials, arbitrary headers, auth configuration, or request bodies.
- Response Headers and Cookies tables with parsed Set-Cookie attributes.
- Import curl commands and copy the current request as curl / fetch / Python.
- Command palette (⌘K) and global keyboard shortcuts for sending (⌘↵), focusing the URL (⌘\), switching methods, and opening shortcut help (?).
- Syntax-highlighted response body with Pretty/Raw/Preview toggle and redirect chain.
- Typed request bodies — JSON/form/raw with automatic Content-Type.
- Request builder: headers, query params with URL sync, and Bearer/Basic/API-key auth presets.
- CORS relay Route Handler with automatic direct-to-relay fallback and SSRF guards (scheme allowlist, private/loopback/link-local, CGNAT and metadata address blocking, pinned DNS results, redirect revalidation, size/time caps, and hop-by-hop stripping).
- Send a request and view its status, elapsed time, size, and pretty-printed response body through direct browser fetch.
- Project bootstrap (dev workflow, license, README to follow).
