"use client";

import { useEffect, useState } from "react";

import type { HlTheme } from "./highlight";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readActiveTheme(): HlTheme {
  if (typeof document === "undefined") {
    return "dark";
  }

  const root = document.documentElement;
  const explicitTheme = root.getAttribute("data-theme");

  if (explicitTheme === "light" || explicitTheme === "dark") {
    return explicitTheme;
  }

  if (root.classList.contains("dark")) {
    return "dark";
  }

  if (typeof window.matchMedia === "function") {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  }

  return "dark";
}

export function useActiveTheme(): HlTheme {
  const [theme, setTheme] = useState<HlTheme>(readActiveTheme);

  useEffect(() => {
    const refresh = () => setTheme(readActiveTheme());
    const observer = new MutationObserver(refresh);
    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia(DARK_QUERY)
        : null;

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    mediaQuery?.addEventListener("change", refresh);

    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener("change", refresh);
    };
  }, []);

  return theme;
}
