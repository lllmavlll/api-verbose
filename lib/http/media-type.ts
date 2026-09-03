export function normalizeMediaType(contentType: string | undefined): string {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function isJsonMediaType(contentType: string | undefined): boolean {
  const type = normalizeMediaType(contentType);
  return type === "application/json" || type.endsWith("+json");
}

export function isXmlMediaType(contentType: string | undefined): boolean {
  const type = normalizeMediaType(contentType);
  return type.endsWith("/xml") || type.endsWith("+xml");
}

export function isImageMediaType(contentType: string | undefined): boolean {
  return normalizeMediaType(contentType).startsWith("image/");
}

export function isSvgMediaType(contentType: string | undefined): boolean {
  return normalizeMediaType(contentType) === "image/svg+xml";
}

export function isTextualMediaType(contentType: string | undefined): boolean {
  const type = normalizeMediaType(contentType);
  return (
    !type ||
    type.startsWith("text/") ||
    isJsonMediaType(type) ||
    isXmlMediaType(type)
  );
}
