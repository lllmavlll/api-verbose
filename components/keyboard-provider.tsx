"use client";

import { useEffect, useState, type ReactNode } from "react";

import { CommandPalette } from "@/components/command-palette";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import {
  PALETTE_TOGGLE,
  matchEvent,
  registerCommand,
} from "@/lib/commands";

type KeyboardProviderProps = {
  children: ReactNode;
};

export function KeyboardProvider({ children }: KeyboardProviderProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const unregisterPalette = registerCommand({
      id: "open-palette",
      title: "Command palette",
      keys: PALETTE_TOGGLE,
      group: "View",
      run: () => setPaletteOpen((open) => !open),
    });
    const unregisterHelp = registerCommand({
      id: "open-shortcuts",
      title: "Keyboard shortcuts",
      keys: "?",
      group: "View",
      run: () => setHelpOpen(true),
    });

    function handleKeyDown(event: KeyboardEvent) {
      const command = matchEvent(event);
      if (!command) return;

      event.preventDefault();
      command.run();
    }

    window.addEventListener("keydown", handleKeyDown);
    document.documentElement.dataset.keyboardReady = "true";
    return () => {
      delete document.documentElement.dataset.keyboardReady;
      window.removeEventListener("keydown", handleKeyDown);
      unregisterHelp();
      unregisterPalette();
    };
  }, []);

  return (
    <>
      {children}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
