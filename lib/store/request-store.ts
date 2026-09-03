import { create } from "zustand";

import type { Auth, Body, HttpMethod, KV, RequestSpec } from "@/lib/http/types";
import { parseParams, serializeParams } from "@/lib/request/params";

export const INITIAL_SPEC: RequestSpec = {
  method: "GET",
  url: "",
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
};

export interface RequestStore {
  spec: RequestSpec;
  setMethod(method: HttpMethod): void;
  setUrl(url: string): void;
  setParams(params: KV[]): void;
  setHeaders(headers: KV[]): void;
  setAuth(auth: Auth): void;
  setBody(body: Body): void;
  loadSpec(spec: RequestSpec): void;
  reset(): void;
}

function freshInitialSpec(): RequestSpec {
  return {
    ...INITIAL_SPEC,
    headers: [],
    params: [],
    auth: { kind: "none" },
    body: { kind: "none" },
  };
}

function baseOf(url: string): string {
  try {
    return parseParams(url).base;
  } catch {
    const queryIndex = url.indexOf("?");
    return queryIndex === -1 ? url : url.slice(0, queryIndex);
  }
}

export const useRequestStore = create<RequestStore>((set) => ({
  spec: freshInitialSpec(),
  setMethod: (method) =>
    set(({ spec }) => ({ spec: { ...spec, method } })),
  setUrl: (url) =>
    set(({ spec }) => {
      try {
        return { spec: { ...spec, url, params: parseParams(url).params } };
      } catch {
        return { spec: { ...spec, url } };
      }
    }),
  setParams: (params) =>
    set(({ spec }) => ({
      spec: {
        ...spec,
        url: serializeParams(baseOf(spec.url), params),
        params,
      },
    })),
  setHeaders: (headers) =>
    set(({ spec }) => ({ spec: { ...spec, headers } })),
  setAuth: (auth) => set(({ spec }) => ({ spec: { ...spec, auth } })),
  setBody: (body) => set(({ spec }) => ({ spec: { ...spec, body } })),
  loadSpec: (spec) =>
    set({
      spec: {
        ...spec,
        headers: spec.headers.map((header) => ({ ...header })),
        params: spec.params.map((param) => ({ ...param })),
        auth: { ...spec.auth },
        body: { ...spec.body },
      },
    }),
  reset: () => set({ spec: freshInitialSpec() }),
}));
