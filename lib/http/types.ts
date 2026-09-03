export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export const HTTP_METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export interface KV {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export type Auth =
  | { kind: "none" }
  | { kind: "bearer"; token: string }
  | { kind: "basic"; username: string; password: string }
  | {
      kind: "apikey";
      name: string;
      value: string;
      in: "header" | "query";
    };

export type Body =
  | { kind: "none" }
  | { kind: "json"; text: string }
  | { kind: "raw"; text: string; contentType: string }
  | { kind: "form"; fields: KV[] };

export interface RequestSpec {
  method: HttpMethod;
  url: string;
  headers: KV[];
  params: KV[];
  auth: Auth;
  body: Body;
}

export type ResponseBody =
  | { encoding: "utf8"; text: string }
  | { encoding: "base64"; data: string };

export type SendSuccess = {
  ok: true;
  via: "direct" | "relay";
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  body: ResponseBody;
  isJson: boolean;
  headers: [string, string][];
  redirects?: { url: string; status: number }[];
};

export type SendFailure = {
  ok: false;
  kind: "invalid-url" | "invalid-headers" | "network";
  message: string;
};

export type SendResult = SendSuccess | SendFailure;
