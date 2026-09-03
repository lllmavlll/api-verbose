import type { KV, RequestSpec } from "@/lib/http/types";

import { applyAuth } from "./auth";
import { parseParams, serializeParams } from "./params";

export interface RequestCollisions {
  headerKeys: string[];
  paramKeys: string[];
}

const isWireRow = ({ enabled, key }: KV): boolean => enabled && key !== "";

export function detectCollisions(spec: RequestSpec): RequestCollisions {
  const additions = applyAuth(spec.auth);
  const authHeaderKeys = new Set(
    additions.headers.filter(isWireRow).map(({ key }) => key.toLowerCase()),
  );
  const authParamKeys = new Set(
    additions.params.filter(isWireRow).map(({ key }) => key),
  );

  return {
    headerKeys: [
      ...new Set(
        spec.headers
          .filter(isWireRow)
          .map(({ key }) => key.toLowerCase())
          .filter((key) => authHeaderKeys.has(key)),
      ),
    ],
    paramKeys: [
      ...new Set(
        spec.params
          .filter(isWireRow)
          .map(({ key }) => key)
          .filter((key) => authParamKeys.has(key)),
      ),
    ],
  };
}

export function composeRequest(spec: RequestSpec): RequestSpec {
  const additions = applyAuth(spec.auth);
  const { headerKeys, paramKeys } = detectCollisions(spec);
  const collidingHeaders = new Set(headerKeys);
  const collidingParams = new Set(paramKeys);
  const base = parseParams(spec.url).base;

  const headers = spec.headers
    .filter(isWireRow)
    .filter(({ key }) => !collidingHeaders.has(key.toLowerCase()))
    .concat(additions.headers.filter(isWireRow));
  const params = spec.params
    .filter(isWireRow)
    .filter(({ key }) => !collidingParams.has(key))
    .concat(additions.params.filter(isWireRow));

  return {
    method: spec.method,
    url: serializeParams(base, params),
    headers,
    params: [],
    auth: { kind: "none" },
    body: spec.body,
  };
}
