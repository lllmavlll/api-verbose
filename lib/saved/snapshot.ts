import type { Auth, Body, KV, RequestSpec } from "@/lib/http/types";

function cloneRows(rows: KV[] | undefined): KV[] {
  return (rows ?? []).map((row) => ({ ...row }));
}

function cloneAuth(auth: Auth | undefined): Auth {
  return auth ? { ...auth } : { kind: "none" };
}

function cloneBody(body: Body | undefined): Body {
  if (!body) return { kind: "none" };
  if (body.kind === "form") {
    return { kind: "form", fields: cloneRows(body.fields) };
  }
  return { ...body };
}

export function toSavedSnapshot(spec: RequestSpec): RequestSpec {
  return {
    method: spec.method,
    url: spec.url,
    headers: cloneRows(spec.headers),
    params: cloneRows(spec.params),
    auth: cloneAuth(spec.auth),
    body: cloneBody(spec.body),
  };
}

export function fromSavedSnapshot(spec: RequestSpec): RequestSpec {
  return toSavedSnapshot(spec);
}

export function suggestName(spec: RequestSpec): string {
  try {
    const url = new URL(spec.url);
    return `${spec.method} ${url.host}${url.pathname}`;
  } catch {
    return `${spec.method} ${spec.url}`;
  }
}
