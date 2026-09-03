# Verbose

Verbose is a local-first REST client for the browser. Pick an HTTP method, enter an absolute HTTP or HTTPS URL, and send the request to see its status, elapsed time, response size, and body. JSON responses are formatted for readability; other responses are shown as raw text.

This first walking skeleton sends directly from the browser. An endpoint that does not allow cross-origin browser requests will show a clear CORS error until the built-in relay lands in the next slice.

## Run locally

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a CORS-permitting endpoint such as `https://api.github.com/zen`, and select **Send**. You can also submit with <kbd>⌘</kbd>+<kbd>Enter</kbd> or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>.

## Verify

```sh
npm test
npm run build
npx playwright test
```

Third-party weak-copyleft exceptions and release-time obligations are recorded
in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). Run
`npm run license:check` after every dependency change.
