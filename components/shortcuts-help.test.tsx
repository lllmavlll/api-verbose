import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { clearCommands, registerCommand } from "@/lib/commands";

import { ShortcutsHelp } from "./shortcuts-help";

beforeEach(() => clearCommands());

it("lists every active binding as action + keys, omitting keyless commands", () => {
  registerCommand({
    id: "send",
    title: "Send request",
    keys: "mod+enter",
    run: vi.fn(),
  });
  registerCommand({
    id: "focus-url",
    title: "Focus URL",
    keys: "mod+\\",
    run: vi.fn(),
  });
  registerCommand({
    id: "method-post",
    title: "Switch method → POST",
    run: vi.fn(),
  });
  render(<ShortcutsHelp open platform="mac" onOpenChange={vi.fn()} />);

  expect(screen.getByRole("dialog")).toHaveTextContent(/keyboard shortcuts/i);
  expect(screen.getByText("Send request")).toBeInTheDocument();
  expect(screen.getByText("⌘↵")).toBeInTheDocument();
  expect(screen.getByText("Focus URL")).toBeInTheDocument();
  expect(screen.queryByText("Switch method → POST")).not.toBeInTheDocument();
});
