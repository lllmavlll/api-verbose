import type { Grammar } from "./detect";

export type HlTheme = "light" | "dark";

const SHIKI_THEME: Record<HlTheme, "github-light" | "github-dark"> = {
  light: "github-light",
  dark: "github-dark",
};

async function loadHighlighter() {
  const { createHighlighter } = await import("shiki");

  return createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: ["json", "xml", "html"],
  });
}

let highlighterPromise: ReturnType<typeof loadHighlighter> | null = null;

function getHighlighter() {
  highlighterPromise ??= loadHighlighter();
  return highlighterPromise;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatForGrammar(bodyText: string, grammar: Grammar): string {
  if (grammar !== "json") {
    return bodyText;
  }

  try {
    return JSON.stringify(JSON.parse(bodyText), null, 2);
  } catch {
    return bodyText;
  }
}

export async function highlightToHtml(
  code: string,
  grammar: Grammar,
  theme: HlTheme,
): Promise<string> {
  if (grammar === "text") {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }

  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: grammar,
    theme: SHIKI_THEME[theme],
  });
}
