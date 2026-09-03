import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { clearCommands, registerCommand } from "@/lib/commands";

import { KeyboardProvider } from "./keyboard-provider";

beforeEach(() => clearCommands());

it("runs a registered modifier-chord command from a global keydown", () => {
  const send = vi.fn();
  render(
    <KeyboardProvider>
      <div>app</div>
    </KeyboardProvider>,
  );
  registerCommand({
    id: "send",
    title: "Send",
    keys: "mod+enter",
    run: send,
  });
  fireEvent.keyDown(window, { key: "Enter", metaKey: true });
  expect(send).toHaveBeenCalledTimes(1);
});

it("toggles the Command+K palette open and shut", () => {
  render(
    <KeyboardProvider>
      <div>app</div>
    </KeyboardProvider>,
  );
  expect(
    screen.queryByPlaceholderText(/type a command/i),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(
    screen.queryByPlaceholderText(/type a command/i),
  ).not.toBeInTheDocument();
});

it("opens shortcut help with ? outside editable fields", () => {
  render(
    <KeyboardProvider>
      <div>app</div>
    </KeyboardProvider>,
  );
  fireEvent.keyDown(window, { key: "?" });
  expect(screen.getByRole("dialog")).toHaveTextContent(/keyboard shortcuts/i);
});
