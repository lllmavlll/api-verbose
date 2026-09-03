import type { Auth, KV } from "@/lib/http/types";

export interface AuthAdditions {
  headers: KV[];
  params: KV[];
}

function row(key: string, value: string): KV {
  return {
    id: crypto.randomUUID(),
    key,
    value,
    enabled: true,
  };
}

function encodeBase64(value: string): string {
  return typeof btoa === "function"
    ? btoa(value)
    : Buffer.from(value).toString("base64");
}

export function applyAuth(auth: Auth): AuthAdditions {
  switch (auth.kind) {
    case "none":
      return { headers: [], params: [] };
    case "bearer":
      return {
        headers: [row("Authorization", `Bearer ${auth.token}`)],
        params: [],
      };
    case "basic":
      return {
        headers: [
          row(
            "Authorization",
            `Basic ${encodeBase64(`${auth.username}:${auth.password}`)}`,
          ),
        ],
        params: [],
      };
    case "apikey": {
      const addition = row(auth.name, auth.value);
      return auth.in === "header"
        ? { headers: [addition], params: [] }
        : { headers: [], params: [addition] };
    }
  }
}
