"use client";

import { useSyncExternalStore } from "react";

import {
  Command as CommandRoot,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  formatChord,
  listCommands,
  subscribe,
  type Command,
} from "@/lib/commands";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function groupCommands(commands: Command[]) {
  const groups = new Map<string, Command[]>();

  for (const command of commands) {
    const group = command.group ?? "Other";
    groups.set(group, [...(groups.get(group) ?? []), command]);
  }

  return groups;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const commands = useSyncExternalStore(subscribe, listCommands, listCommands);
  const groups = groupCommands(commands);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Search for an action to run"
    >
      <CommandRoot>
        <CommandInput autoFocus placeholder="Type a command…" />
        <CommandList>
          <CommandEmpty>No commands</CommandEmpty>
          {Array.from(groups, ([group, groupCommands]) => (
            <CommandGroup heading={group} key={group}>
              {groupCommands.map((command) => (
                <CommandItem
                  key={command.id}
                  onSelect={() => {
                    command.run();
                    onOpenChange(false);
                  }}
                  value={command.title}
                >
                  <span>{command.title}</span>
                  {command.keys ? (
                    <CommandShortcut aria-label={`Shortcut: ${command.keys}`}>
                      {formatChord(command.keys)}
                    </CommandShortcut>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandRoot>
    </CommandDialog>
  );
}
