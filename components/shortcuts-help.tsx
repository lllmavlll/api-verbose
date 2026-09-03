"use client";

import { useSyncExternalStore } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  detectPlatform,
  formatChord,
  listCommands,
  subscribe,
} from "@/lib/commands";

type ShortcutsHelpProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform?: "mac" | "other";
};

export function ShortcutsHelp({
  open,
  onOpenChange,
  platform = detectPlatform(),
}: ShortcutsHelpProps) {
  const commands = useSyncExternalStore(subscribe, listCommands, listCommands);
  const boundCommands = commands.filter((command) => command.keys);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Active shortcuts available in this workspace.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3">
          {boundCommands.map((command) => (
            <div className="contents" key={command.id}>
              <dt>{command.title}</dt>
              <dd>
                <kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                  {formatChord(command.keys!, platform)}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
