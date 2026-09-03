import type { Grammar } from "./detect";
import { SHIKI_THEMES, type ShikiThemeName } from "@/lib/theme/shiki-theme";

async function loadHighlighter() {
  const { createCssVariablesTheme, createHighlighter } = await import("shiki");

  return createHighlighter({
    themes: [
      createCssVariablesTheme({ name: SHIKI_THEMES.light }),
      createCssVariablesTheme({ name: SHIKI_THEMES.dark }),
    ],
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
  theme: ShikiThemeName,
): Promise<string> {
  if (grammar === "text") {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }

  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: grammar,
    theme,
  });
}
