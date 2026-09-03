const MAX_PRETTY_PRINT_BYTES = 1024 * 1024;

export function formatBody(bodyText: string, isJson: boolean): string {
  if (
    !isJson ||
    new TextEncoder().encode(bodyText).length > MAX_PRETTY_PRINT_BYTES
  ) {
    return bodyText;
  }

  try {
    return JSON.stringify(JSON.parse(bodyText), null, 2);
  } catch {
    return bodyText;
  }
}
