"use client";

import {
  ThemeProvider as NextThemesProvider,
  useTheme,
} from "next-themes";

export type Theme = "light" | "dark" | "system";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      storageKey="verbose-theme"
    >
      {children}
    </NextThemesProvider>
  );
}

export { useTheme };
