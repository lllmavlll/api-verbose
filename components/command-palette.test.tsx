import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { clearCommands, registerCommand } from "@/lib/commands";

import { CommandPalette } from "./command-palette";

beforeEach(() => clearCommands());

it("lists registered commands, runs one on Enter, and closes", async () => {
  const focusUrl = vi.fn();
  const onOpenChange = vi.fn();
  registerCommand({
    id: "focus-url",
    title: "Focus URL",
    keys: "mod+\\",
    group: "Request",
    run: focusUrl,
  });
  registerCommand({
    id: "send",
    title: "Send request",
    keys: "mod+enter",
    group: "Request",
    run: vi.fn(),
  });
  const user = userEvent.setup();
  render(<CommandPalette open onOpenChange={onOpenChange} />);

  expect(screen.getByText("Focus URL")).toBeInTheDocument();
  expect(screen.getByText("Send request")).toBeInTheDocument();

  await user.keyboard("Focus");
  expect(screen.queryByText("Send request")).not.toBeInTheDocument();

  await user.keyboard("{Enter}");
  expect(focusUrl).toHaveBeenCalledTimes(1);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("shows a quiet empty state when nothing matches", async () => {
  registerCommand({
    id: "send",
    title: "Send request",
    keys: "mod+enter",
    run: vi.fn(),
  });
  const user = userEvent.setup();
  render(<CommandPalette open onOpenChange={vi.fn()} />);
  await user.keyboard("zzzz");
  expect(screen.getByText(/no commands/i)).toBeInTheDocument();
});
