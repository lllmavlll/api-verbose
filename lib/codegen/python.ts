import type { RequestSpec } from "@/lib/http/types";

import { effectiveBody, effectiveManualHeaders } from "./effective";

function pythonString(value: string): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n")
    .replaceAll("\t", "\\t")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, (character) =>
      `\\x${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
    );
  return `'${escaped}'`;
}

export function generatePython(spec: RequestSpec): string {
  const body = effectiveBody(spec);
  const headers = effectiveManualHeaders(spec);
  const headerEntries = headers.map(
    ({ key, value }) => `${pythonString(key)}: ${pythonString(value)}`,
  );
  if (
    body?.contentType &&
    !headers.some(
      ({ key, value }) =>
        key.toLowerCase() === "content-type" && value.trim() !== "",
    )
  ) {
    headerEntries.push(
      `${pythonString("Content-Type")}: ${pythonString(body.contentType)}`,
    );
  }

  const kwargs: string[] = [];
  if (headerEntries.length > 0) {
    kwargs.push(`headers={${headerEntries.join(", ")}}`);
  }

  if (body) {
    kwargs.push(`data=${pythonString(body.bodyText)}`);
  }
  if (spec.auth.kind === "basic") {
    kwargs.push(
      `auth=(${pythonString(spec.auth.username)}, ${pythonString(spec.auth.password)})`,
    );
  }

  const argumentsText = kwargs.length > 0 ? `,\n    ${kwargs.join(",\n    ")}` : "";
  return `import requests\n\nresponse = requests.request(${pythonString(spec.method)}, ${pythonString(spec.url)}${argumentsText}\n)`;
}
