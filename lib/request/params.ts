import type { KV } from "@/lib/http/types";

function createId(): string {
  return crypto.randomUUID();
}

function splitFragment(url: string): { beforeFragment: string; fragment: string } {
  const fragmentIndex = url.indexOf("#");
  if (fragmentIndex === -1) {
    return { beforeFragment: url, fragment: "" };
  }

  return {
    beforeFragment: url.slice(0, fragmentIndex),
    fragment: url.slice(fragmentIndex),
  };
}

export function parseParams(url: string): { base: string; params: KV[] } {
  const { beforeFragment, fragment } = splitFragment(url);
  const queryIndex = beforeFragment.indexOf("?");
  if (queryIndex === -1) {
    return { base: url, params: [] };
  }

  const base = beforeFragment.slice(0, queryIndex) + fragment;
  const query = beforeFragment.slice(queryIndex + 1);
  if (query === "") {
    return { base, params: [] };
  }

  const params = query.split("&").map((pair) => {
    const separatorIndex = pair.indexOf("=");
    const rawKey = separatorIndex === -1 ? pair : pair.slice(0, separatorIndex);
    const rawValue = separatorIndex === -1 ? "" : pair.slice(separatorIndex + 1);

    return {
      id: createId(),
      key: decodeURIComponent(rawKey),
      value: decodeURIComponent(rawValue),
      enabled: true,
    };
  });

  return { base, params };
}

export function serializeParams(base: string, params: KV[]): string {
  const query = params
    .filter(({ enabled, key }) => enabled && key !== "")
    .map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  if (query === "") {
    return base;
  }

  const { beforeFragment, fragment } = splitFragment(base);
  return `${beforeFragment}?${query}${fragment}`;
}
