export const SHIKI_THEMES = {
  light: "github-light",
  dark: "github-dark",
} as const;

export type ShikiThemeName =
  (typeof SHIKI_THEMES)[keyof typeof SHIKI_THEMES];

export function shikiThemeFor(
  resolvedTheme: "light" | "dark" | undefined,
): ShikiThemeName {
  return resolvedTheme === "light" ? SHIKI_THEMES.light : SHIKI_THEMES.dark;
}
