import type { Body, HttpMethod, RequestSpec } from "./types";

const BODY_METHODS = new Set<HttpMethod>([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

export type SerializedBody = {
  bodyText: string;
  contentType: string;
};

export function bodyAllows(method: HttpMethod): boolean {
  return BODY_METHODS.has(method);
}

export function serializeBody(body: Body): SerializedBody | null {
  switch (body.kind) {
    case "none":
      return null;
    case "json":
      return body.text.trim() === ""
        ? null
        : { bodyText: body.text, contentType: "application/json" };
    case "raw":
      return body.text === ""
        ? null
        : {
            bodyText: body.text,
            contentType: body.contentType.trim() || "text/plain",
          };
    case "form": {
      const params = new URLSearchParams();
      for (const field of body.fields) {
        if (field.enabled && field.key !== "") {
          params.append(field.key, field.value);
        }
      }
      const bodyText = params.toString();
      return bodyText === ""
        ? null
        : {
            bodyText,
            contentType: "application/x-www-form-urlencoded",
          };
    }
  }
}

export function isValidJson(text: string): boolean {
  if (text === "") {
    return false;
  }

  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function buildBody(
  spec: RequestSpec,
): { bodyText: string; contentType: string | null } | null {
  if (!bodyAllows(spec.method)) {
    return null;
  }

  const serialized = serializeBody(spec.body);
  if (!serialized) {
    return null;
  }

  const hasExplicitContentType = spec.headers.some(
    ({ enabled, key, value }) =>
      enabled &&
      key.toLowerCase() === "content-type" &&
      value.trim() !== "",
  );

  return {
    bodyText: serialized.bodyText,
    contentType: hasExplicitContentType ? null : serialized.contentType,
  };
}
