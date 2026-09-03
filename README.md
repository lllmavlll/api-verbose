# Verbose

Verbose is a local-first REST client for the browser. Pick an HTTP method, enter an absolute HTTP or HTTPS URL, and send the request to see its status, elapsed time, response size, content type, and body.

Verbose sends directly from the browser first. If an idempotent request is blocked in the CORS/network path, it falls back through the in-app relay and labels the result `via relay`. Ambiguous `POST` and `PATCH` failures are never retried automatically, avoiding duplicate writes.

The interface follows the browser's light or dark OS preference on first visit. Use the theme control in the app header to choose Light, Dark, or System; an explicit choice stays local to that browser and survives reloads. Response syntax highlighting follows the active theme without requiring another request.

## Response views

- **Pretty** formats JSON and applies theme-aware Shiki highlighting to JSON, HTML, and XML responses.
- **Raw** preserves the exact received text, while responses at or above 1 MB automatically skip highlighting.
- **Preview** renders HTML inside a script-free, network-blocked sandbox and shows image responses from a local blob URL.
- Redirected requests show the known path from the original URL to the final response.

Every successful response also exposes counted **Headers** and **Cookies** tabs. Headers are sorted into a monospace name/value table, while visible `Set-Cookie` values are parsed into cookie attributes; browsers may hide those cookie headers on direct requests, so the empty state points to the relay path.

Screenshots: [Pretty (dark)](https://github.com/vegastack/agent-dev-review-evidence/blob/main/api-verbose/6/20260903T085942Z-render-pretty-dark.png) · [Pretty (light)](https://github.com/vegastack/agent-dev-review-evidence/blob/main/api-verbose/6/20260903T085942Z-render-pretty-light.png) · [Raw](https://github.com/vegastack/agent-dev-review-evidence/blob/main/api-verbose/6/20260903T085942Z-render-raw.png) · [sandboxed HTML Preview](https://github.com/vegastack/agent-dev-review-evidence/blob/main/api-verbose/6/20260903T085942Z-render-preview-html.png) · [redirect chain](https://github.com/vegastack/agent-dev-review-evidence/blob/main/api-verbose/6/20260903T085942Z-render-redirect-chain.png)

## Run locally

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter an endpoint such as `https://api.github.com/zen`, and select **Send**. The request flow is fully keyboard-operable through the command palette and global shortcuts.

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Open command palette | <kbd>⌘</kbd>+<kbd>K</kbd> | <kbd>Ctrl</kbd>+<kbd>K</kbd> |
| Send request | <kbd>⌘</kbd>+<kbd>Enter</kbd> | <kbd>Ctrl</kbd>+<kbd>Enter</kbd> |
| Focus URL | <kbd>⌘</kbd>+<kbd>\\</kbd> | <kbd>Ctrl</kbd>+<kbd>\\</kbd> |
| Show active shortcuts | <kbd>?</kbd> | <kbd>?</kbd> |
| Recall history while URL is focused | <kbd>↑</kbd> / <kbd>↓</kbd> | <kbd>↑</kbd> / <kbd>↓</kbd> |

The relay is a Node-runtime Next.js Route Handler in this same app. It needs no separate service, account, persistence, or secrets. Self-host on a Node-compatible Next.js runtime: the relay relies on Node DNS and HTTP(S) connection controls to pin every request and redirect to the public address it validated while preserving the target hostname for Host/SNI.

The relay fetches user-supplied URLs server-side, so its security perimeter is load-bearing. It rejects non-HTTP schemes and private, loopback, link-local, CGNAT, and cloud-metadata addresses; revalidates redirects; strips hop-by-hop headers; and enforces request timeout and response-size caps. Do not expose a deployment publicly until the shipping review has confirmed those guards on the chosen Node host.

Use **Query Params** to add repeated or encoded query values; enabled rows stay in live two-way sync with the URL bar. Use **Headers** for custom request headers. Both tables always keep a blank trailing row ready for keyboard entry, and disabled rows are kept in the editor without being sent.

Duplicate header rows remain separate in the request model. On the direct browser path, Fetch may serialize same-name rows as one comma-joined header; transports that support physical repeated header fields can preserve them on the wire.

The **Auth** panel can add a Bearer token, Basic credentials, or an API key sent as either a header or query parameter. Auth values remain in memory only and are not persisted. When an auth preset collides with a manual row, the preset wins and the overridden row is marked in the table.

Use **Body** to keep separate in-session drafts for JSON, URL-encoded form fields, and raw text. JSON and raw bodies use the CodeMirror editor; malformed JSON is allowed and sent exactly as typed. Verbose supplies the matching `Content-Type` automatically unless an enabled header row already sets one. Bodies are sent only for `POST`, `PUT`, `PATCH`, and `DELETE`; other methods keep the draft visible and show that it will not be sent.

## Request history

Every resolved send is added to a browser-local history in IndexedDB, including failed attempts. History survives reloads, lists the newest request first, can be searched by method or URL, and is capped at 500 entries. Use **Replay** or the URL field's <kbd>↑</kbd>/<kbd>↓</kbd> shortcuts to restore a method and URL without sending automatically; replay clears any stale headers, auth, and body from the builder first. History can be exported as JSON or cleared after confirmation.

Automatic history deliberately stores only method, URL, timestamp, and non-sensitive response metadata. It never stores credentials, arbitrary request headers, auth configuration, request bodies, or response bodies and headers. The data stays in this browser: there are no accounts, server-side persistence, or cloud sync.

## Import & copy-as-code

Use **Import curl** to paste a curl command and replace the live request with its method, URL and query parameters, headers, text body, and Basic credentials. Supported flags populate the existing request builder; unsupported flags are listed in a visible ignored-flags note instead of being silently dropped. Imports remain in memory and are not persisted by this feature.

Use **Copy as** to copy the effective request Verbose can send as a runnable curl command, JavaScript `fetch` call, or Python `requests` snippet. The generators preserve its method, URL, enabled headers, sendable body bytes (including JSON whitespace), and Basic auth while escaping each target language safely. Copying that curl command back into Verbose reproduces the same wire request; internal editor distinctions that curl cannot express, such as implicit versus explicit Content-Type or form fields versus equivalent URL-encoded text, may normalize on import.

## Verify

```sh
npm test
npm run build
npx playwright test
```

Third-party weak-copyleft exceptions and release-time obligations are recorded
in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). Run
`npm run license:check` after every dependency change.
