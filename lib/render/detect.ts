import {
  isImageMediaType,
  isJsonMediaType,
  isTextualMediaType,
  isXmlMediaType,
  normalizeMediaType,
} from "@/lib/http/media-type";

export const HIGHLIGHT_CAP_BYTES = 1_000_000;

export type Grammar = "json" | "xml" | "html" | "text";
export type PreviewKind = "html" | "image" | null;

function parsesAsJson(bodyText: string): boolean {
  try {
    JSON.parse(bodyText);
    return true;
  } catch {
    return false;
  }
}

export function isBinary(contentType: string | undefined): boolean {
  const type = normalizeMediaType(contentType);

  return !isTextualMediaType(type) && !isImageMediaType(type);
}

export function detectGrammar(
  contentType: string | undefined,
  bodyText: string,
): Grammar {
  const type = normalizeMediaType(contentType);

  if (isJsonMediaType(type)) {
    return "json";
  }

  if (type === "text/html") {
    return "html";
  }

  if (isXmlMediaType(type)) {
    return "xml";
  }

  if (!type || type.startsWith("text/")) {
    return parsesAsJson(bodyText) ? "json" : "text";
  }

  return "text";
}

export function detectPreview(contentType: string | undefined): PreviewKind {
  const type = normalizeMediaType(contentType);

  if (type === "text/html") {
    return "html";
  }

  if (isImageMediaType(type)) {
    return "image";
  }

  return null;
}

export function shouldHighlight(sizeBytes: number, grammar: Grammar): boolean {
  return sizeBytes < HIGHLIGHT_CAP_BYTES && grammar !== "text";
}
