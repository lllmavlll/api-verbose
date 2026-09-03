import { buildBody } from "@/lib/http/body";
import type { KV, RequestSpec } from "@/lib/http/types";

export function effectiveManualHeaders(spec: RequestSpec): KV[] {
  const automaticContentType = buildBody(spec)?.contentType;

  return spec.headers
    .filter(({ enabled, key }) => enabled && key !== "")
    .filter(
      ({ key }) =>
        !(spec.auth.kind === "basic" && key.toLowerCase() === "authorization"),
    )
    .filter(
      ({ key, value }) =>
        !(
          automaticContentType &&
          key.toLowerCase() === "content-type" &&
          value.trim() === ""
        ),
    );
}

export function effectiveBody(spec: RequestSpec): {
  bodyText: string;
  contentType: string;
} | null {
  const body = buildBody(spec);
  if (!body) return null;

  const explicitContentType = spec.headers.find(
    ({ enabled, key, value }) =>
      enabled &&
      key.toLowerCase() === "content-type" &&
      value.trim() !== "",
  )?.value;

  return {
    ...body,
    contentType: explicitContentType ?? body.contentType ?? "",
  };
}
