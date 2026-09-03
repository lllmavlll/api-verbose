import { buildBody } from "@/lib/http/body";
import type { RequestSpec } from "@/lib/http/types";

import { effectiveManualHeaders } from "./effective";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function generateCurl(spec: RequestSpec): string {
  const command = [`curl -X ${spec.method}`, shellQuote(spec.url)];
  const headers = effectiveManualHeaders(spec);
  const body = buildBody(spec);

  for (const { key, value } of headers) {
    command.push("-H", shellQuote(`${key}: ${value}`));
  }

  if (body?.contentType) {
    command.push("-H", shellQuote(`Content-Type: ${body.contentType}`));
  }

  if (spec.auth.kind === "basic") {
    command.push(
      "-u",
      shellQuote(`${spec.auth.username}:${spec.auth.password}`),
    );
  }

  if (body) {
    command.push("-d", shellQuote(body.bodyText));
  }

  return command.join(" ");
}
