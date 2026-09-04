"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { type Theme, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";

const nextTheme: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const themeIcon = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} satisfies Record<Theme, typeof Monitor>;

function isTheme(value: string | undefined): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const hydrated = useHydrated();
  const selectedTheme = hydrated && isTheme(theme) ? theme : "system";
  const upcomingTheme = nextTheme[selectedTheme];
  const Icon = themeIcon[selectedTheme];

  return (
    <Button
      aria-label={`Toggle theme, current ${selectedTheme}, next ${upcomingTheme}`}
      onClick={() => setTheme(upcomingTheme)}
      size="icon"
      type="button"
      variant="outline"
    >
      <Icon aria-hidden />
    </Button>
  );
}
