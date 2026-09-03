export function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    decodeURIComponent(url.search);
    return true;
  } catch {
    return false;
  }
}
