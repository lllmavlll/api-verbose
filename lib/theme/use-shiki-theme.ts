"use client";

import { useTheme } from "@/components/theme-provider";

import { shikiThemeFor, type ShikiThemeName } from "./shiki-theme";

export function useShikiTheme(): ShikiThemeName {
  const { resolvedTheme } = useTheme();

  return shikiThemeFor(resolvedTheme === "light" ? "light" : resolvedTheme === "dark" ? "dark" : undefined);
}
