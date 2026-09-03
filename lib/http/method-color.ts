import type { HttpMethod } from "./types";

const METHOD_COLOR_CLASSES: Partial<Record<HttpMethod, string>> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
};

export function methodColorClass(method: HttpMethod): string {
  return METHOD_COLOR_CLASSES[method] ?? "text-muted-foreground";
}
