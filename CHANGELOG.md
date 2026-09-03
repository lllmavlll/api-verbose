# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Response Headers and Cookies tables with parsed Set-Cookie attributes.
- Import curl commands and copy the current request as curl / fetch / Python.
- Command palette (⌘K) and global keyboard shortcuts for sending (⌘↵), focusing the URL (⌘\), switching methods, and opening shortcut help (?).
- Syntax-highlighted response body with Pretty/Raw/Preview toggle and redirect chain.
- Typed request bodies — JSON/form/raw with automatic Content-Type.
- Request builder: headers, query params with URL sync, and Bearer/Basic/API-key auth presets.
- CORS relay Route Handler with automatic direct-to-relay fallback and SSRF guards (scheme allowlist, private/loopback/link-local, CGNAT and metadata address blocking, pinned DNS results, redirect revalidation, size/time caps, and hop-by-hop stripping).
- Send a request and view its status, elapsed time, size, and pretty-printed response body through direct browser fetch.
- Project bootstrap (dev workflow, license, README to follow).
