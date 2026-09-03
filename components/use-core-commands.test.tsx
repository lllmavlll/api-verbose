import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { clearCommands, getCommand, listCommands } from "@/lib/commands";

import { useCoreCommands } from "./use-core-commands";

beforeEach(() => clearCommands());

it("registers Send, Focus URL and one Switch-method command per method", () => {
  renderHook(() =>
    useCoreCommands({
      isSending: false,
      onSend: vi.fn(),
      onFocusUrl: vi.fn(),
      setMethod: vi.fn(),
    }),
  );
  const ids = listCommands().map((command) => command.id);
  expect(ids).toContain("send");
  expect(ids).toContain("focus-url");
  for (const method of [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
  ]) {
    expect(ids).toContain(`method-${method}`);
  }
});

it("Switch method sets the method without sending", () => {
  const setMethod = vi.fn();
  const onSend = vi.fn();
  renderHook(() =>
    useCoreCommands({
      isSending: false,
      onSend,
      onFocusUrl: vi.fn(),
      setMethod,
    }),
  );
  getCommand("method-POST")!.run();
  expect(setMethod).toHaveBeenCalledWith("POST");
  expect(onSend).not.toHaveBeenCalled();
});

it("Send is ignored while a request is in flight", () => {
  const onSend = vi.fn();
  renderHook(() =>
    useCoreCommands({
      isSending: true,
      onSend,
      onFocusUrl: vi.fn(),
      setMethod: vi.fn(),
    }),
  );
  getCommand("send")!.run();
  expect(onSend).not.toHaveBeenCalled();
});

it("uses the latest sending state without re-registering commands", () => {
  const onSend = vi.fn();
  const { rerender } = renderHook(
    ({ isSending }) =>
      useCoreCommands({
        isSending,
        onSend,
        onFocusUrl: vi.fn(),
        setMethod: vi.fn(),
      }),
    { initialProps: { isSending: true } },
  );

  rerender({ isSending: false });
  getCommand("send")!.run();
  expect(onSend).toHaveBeenCalledOnce();
});
