export type CommandGroup = "Request" | "View" | "History";

export interface Command {
  id: string;
  title: string;
  run: () => void;
  keys?: string;
  group?: CommandGroup;
  isAvailable?: () => boolean;
  when?: (event: KeyboardEvent) => boolean;
}

export const PALETTE_TOGGLE = "mod+k";

const commands = new Map<string, Command>();
const listeners = new Set<() => void>();
let registryVersion = 0;
let snapshotVersion = -1;
let snapshot: Command[] = [];

function emitChange() {
  registryVersion += 1;
  for (const listener of listeners) listener();
}

export function registerCommand(command: Command): () => void {
  commands.set(command.id, command);
  emitChange();

  return () => {
    if (commands.get(command.id) === command) {
      commands.delete(command.id);
      emitChange();
    }
  };
}

export function clearCommands(): void {
  commands.clear();
  emitChange();
}

export function listCommands(): Command[] {
  if (snapshotVersion !== registryVersion) {
    snapshot = Array.from(commands.values()).filter(
      (command) => command.isAvailable?.() !== false,
    );
    snapshotVersion = registryVersion;
  }

  return snapshot;
}

export function getCommand(id: string): Command | undefined {
  return commands.get(id);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function eventToChord(event: KeyboardEvent): string {
  const key =
    event.key === "Enter"
      ? "enter"
      : event.key === " "
        ? "space"
        : event.key.toLowerCase();
  return event.metaKey || event.ctrlKey ? `mod+${key}` : key;
}

export function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as
    | {
        tagName?: string;
        isContentEditable?: boolean;
        closest?: (selector: string) => unknown;
        getAttribute?: (name: string) => string | null;
      }
    | null;

  if (!target) return false;

  const tagName = target.tagName?.toUpperCase();
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable === true ||
    target.getAttribute?.("contenteditable") === "true" ||
    Boolean(target.closest?.(".cm-editor"))
  );
}

export function matchEvent(event: KeyboardEvent): Command | null {
  const chord = eventToChord(event);

  for (const command of listCommands()) {
    if (command.keys !== chord) continue;

    const isArrow = chord === "arrowup" || chord === "arrowdown";
    if (isArrow && (!command.when || !command.when(event))) continue;

    if (!chord.startsWith("mod+")) {
      if (!isArrow && command.when && !command.when(event)) continue;
      if (!command.when && isEditableTarget(event)) continue;
    }

    return command;
  }

  return null;
}

export function detectPlatform(): "mac" | "other" {
  if (typeof navigator === "undefined") return "other";
  return /Mac|iPhone|iPad|iPod/i.test(
    `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`,
  )
    ? "mac"
    : "other";
}

const KEY_LABELS: Record<string, string> = {
  enter: "↵",
  arrowup: "↑",
  arrowdown: "↓",
  space: "Space",
  "\\": "\\",
};

export function formatChord(
  keys: string,
  platform: "mac" | "other" = detectPlatform(),
): string {
  const parts = keys.toLowerCase().split("+");
  const labels = parts.map((part) => {
    if (part === "mod") return platform === "mac" ? "⌘" : "Ctrl+";
    return KEY_LABELS[part] ?? part.toUpperCase();
  });

  return labels.join("");
}
