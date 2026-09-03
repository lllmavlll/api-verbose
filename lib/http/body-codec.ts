import { isTextualMediaType } from "./media-type";
import type { ResponseBody } from "./types";

function bytesToBinaryString(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let result = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return result;
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinaryString(bytes));
}

export function base64ToBytes(data: string): Uint8Array {
  return Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
}

export function decodeResponseBody(
  bytes: Uint8Array,
  contentType: string | undefined,
): ResponseBody {
  return isTextualMediaType(contentType)
    ? { encoding: "utf8", text: new TextDecoder().decode(bytes) }
    : { encoding: "base64", data: bytesToBase64(bytes) };
}
