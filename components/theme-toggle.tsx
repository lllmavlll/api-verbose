"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHydrated } from "@/hooks/use-hydrated";

const choices = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
] as const;

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const hydrated = useHydrated();
  const activeTheme = hydrated ? resolvedTheme : undefined;
  const selectedTheme = hydrated ? theme : undefined;
  const Icon =
    selectedTheme === "system"
      ? Monitor
      : activeTheme === "light"
        ? Sun
        : activeTheme === "dark"
          ? Moon
          : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Toggle theme${selectedTheme ? `, current ${selectedTheme}` : ""}`}
            className={selectedTheme === "system" ? "w-auto px-3" : undefined}
            size="icon"
            type="button"
            variant="outline"
          />
        }
      >
        <Icon aria-hidden />
        {selectedTheme === "system" ? (
          <span className="text-xs">System</span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {choices.map((choice) => (
          <DropdownMenuItem
            key={choice.value}
            onClick={() => setTheme(choice.value)}
          >
            {choice.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
