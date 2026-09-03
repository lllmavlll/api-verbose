import type { RequestSpec } from "@/lib/http/types";

import { effectiveBody, effectiveManualHeaders } from "./effective";

function jsString(value: string): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n")
    .replaceAll("\t", "\\t")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return `'${escaped}'`;
}

export function generateFetch(spec: RequestSpec): string {
  const body = effectiveBody(spec);
  const headers = effectiveManualHeaders(spec);
  const headerLines = headers.map(
    ({ key, value }) => `    ${jsString(key)}: ${jsString(value)},`,
  );

  if (
    body?.contentType &&
    !headers.some(
      ({ key, value }) =>
        key.toLowerCase() === "content-type" && value.trim() !== "",
    )
  ) {
    headerLines.push(
      `    ${jsString("Content-Type")}: ${jsString(body.contentType)},`,
    );
  }
  if (spec.auth.kind === "basic") {
    headerLines.push(
      `    ${jsString("Authorization")}: 'Basic ' + btoa(${jsString(`${spec.auth.username}:${spec.auth.password}`)}),`,
    );
  }

  const options = [`  method: ${jsString(spec.method)},`];
  if (headerLines.length > 0) {
    options.push("  headers: {", ...headerLines, "  },");
  }

  if (body) {
    let bodyExpression = jsString(body.bodyText);
    if (body.contentType.toLowerCase().includes("json")) {
      try {
        const parsed = JSON.parse(body.bodyText);
        if (JSON.stringify(parsed) === body.bodyText) {
          bodyExpression = `JSON.stringify(JSON.parse(${jsString(body.bodyText)}))`;
        }
      } catch {
        // Invalid JSON is intentionally sendable; preserve its source bytes.
      }
    }
    options.push(`  body: ${bodyExpression},`);
  }

  return `fetch(${jsString(spec.url)}, {\n${options.join("\n")}\n})`;
}
