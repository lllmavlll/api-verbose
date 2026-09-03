import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PALETTE_TOGGLE,
  clearCommands,
  eventToChord,
  formatChord,
  getCommand,
  isEditableTarget,
  listCommands,
  matchEvent,
  registerCommand,
} from "./commands";

function makeEvent(
  init: KeyboardEventInit,
  target?: object,
) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });

  if (target) {
    Object.defineProperty(event, "target", { value: target, configurable: true });
  }

  return event;
}

beforeEach(() => clearCommands());

describe("registry", () => {
  it("registers, looks up, and unregisters a command", () => {
    const off = registerCommand({ id: "x", title: "X", run: vi.fn() });
    expect(getCommand("x")?.title).toBe("X");
    expect(listCommands().map((command) => command.id)).toContain("x");
    off();
    expect(getCommand("x")).toBeUndefined();
  });

  it("keeps snapshots stable until the registry changes", () => {
    const first = listCommands();
    expect(listCommands()).toBe(first);
    registerCommand({ id: "x", title: "X", run: vi.fn() });
    expect(listCommands()).not.toBe(first);
  });

  it("hides commands whose isAvailable() is false", () => {
    registerCommand({ id: "on", title: "On", run: vi.fn() });
    registerCommand({
      id: "off",
      title: "Off",
      run: vi.fn(),
      isAvailable: () => false,
    });
    const ids = listCommands().map((command) => command.id);
    expect(ids).toContain("on");
    expect(ids).not.toContain("off");
  });
});

describe("matchEvent", () => {
  it("resolves both Command+K and Ctrl+K to the palette toggle", () => {
    registerCommand({
      id: "palette",
      title: "Palette",
      keys: PALETTE_TOGGLE,
      run: vi.fn(),
    });
    expect(matchEvent(makeEvent({ key: "k", metaKey: true }))?.id).toBe(
      "palette",
    );
    expect(matchEvent(makeEvent({ key: "k", ctrlKey: true }))?.id).toBe(
      "palette",
    );
  });

  it("resolves Command+Enter to Send", () => {
    registerCommand({
      id: "send",
      title: "Send",
      keys: "mod+enter",
      run: vi.fn(),
    });
    expect(
      matchEvent(makeEvent({ key: "Enter", metaKey: true }))?.id,
    ).toBe("send");
  });

  it("suppresses a single-key binding in every supported editable target", () => {
    registerCommand({ id: "help", title: "Help", keys: "?", run: vi.fn() });

    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const contentEditable = document.createElement("div");
    contentEditable.setAttribute("contenteditable", "true");

    const codeMirror = document.createElement("div");
    codeMirror.className = "cm-editor";
    const codeMirrorInput = document.createElement("div");
    codeMirror.append(codeMirrorInput);
    const fixtures = document.createElement("div");
    fixtures.append(input, textarea, select, contentEditable, codeMirror);
    document.body.append(fixtures);

    try {
      for (const target of [
        input,
        textarea,
        select,
        contentEditable,
        codeMirrorInput,
      ]) {
        expect(
          matchEvent(makeEvent({ key: "?" }, target)),
          target.outerHTML,
        ).toBeNull();
      }

      expect(
        matchEvent(makeEvent({ key: "?" }, { tagName: "BODY" }))?.id,
      ).toBe("help");
    } finally {
      fixtures.remove();
    }
  });

  it("still fires a modifier chord from inside an editable target", () => {
    registerCommand({
      id: "send",
      title: "Send",
      keys: "mod+enter",
      run: vi.fn(),
    });
    expect(
      matchEvent(
        makeEvent(
          { key: "Enter", metaKey: true },
          { tagName: "TEXTAREA" },
        ),
      )?.id,
    ).toBe("send");
  });

  it("fires a contextual arrow binding only when its predicate passes", () => {
    registerCommand({
      id: "hist-prev",
      title: "Previous request",
      keys: "arrowup",
      run: vi.fn(),
      when: (event) =>
        (event.target as HTMLElement)?.dataset?.requestUrl !== undefined,
    });
    const urlInput = {
      tagName: "INPUT",
      dataset: { requestUrl: "" },
    };
    expect(matchEvent(makeEvent({ key: "ArrowUp" }, urlInput))?.id).toBe(
      "hist-prev",
    );
    expect(
      matchEvent(
        makeEvent({ key: "ArrowUp" }, { tagName: "INPUT", dataset: {} }),
      ),
    ).toBeNull();
  });

  it("rejects arrow bindings that do not provide a context predicate", () => {
    registerCommand({
      id: "unguarded-arrow",
      title: "Unguarded arrow",
      keys: "arrowup",
      run: vi.fn(),
    });

    expect(
      matchEvent(makeEvent({ key: "ArrowUp" }, { tagName: "BODY" })),
    ).toBeNull();
  });

  it("returns null when the matched command is unavailable", () => {
    registerCommand({
      id: "save",
      title: "Save",
      keys: "mod+s",
      run: vi.fn(),
      isAvailable: () => false,
    });
    expect(matchEvent(makeEvent({ key: "s", metaKey: true }))).toBeNull();
  });
});

describe("helpers", () => {
  it("isEditableTarget flags inputs, contenteditable and CodeMirror", () => {
    expect(
      isEditableTarget(makeEvent({ key: "a" }, { tagName: "INPUT" })),
    ).toBe(true);
    expect(
      isEditableTarget(
        makeEvent(
          { key: "a" },
          { tagName: "DIV", isContentEditable: true },
        ),
      ),
    ).toBe(true);
    expect(
      isEditableTarget(makeEvent({ key: "a" }, { tagName: "BODY" })),
    ).toBe(false);
    const codeMirror = {
      tagName: "DIV",
      closest: (selector: string) =>
        selector === ".cm-editor" ? {} : null,
    };
    expect(isEditableTarget(makeEvent({ key: "a" }, codeMirror))).toBe(true);
  });

  it("eventToChord normalizes modifier + key", () => {
    expect(eventToChord(makeEvent({ key: "k", metaKey: true }))).toBe(
      "mod+k",
    );
    expect(eventToChord(makeEvent({ key: "Enter", ctrlKey: true }))).toBe(
      "mod+enter",
    );
    expect(eventToChord(makeEvent({ key: "ArrowUp" }))).toBe("arrowup");
  });

  it("formatChord renders platform glyphs", () => {
    expect(formatChord("mod+k", "mac")).toBe("⌘K");
    expect(formatChord("mod+k", "other")).toBe("Ctrl+K");
    expect(formatChord("mod+enter", "mac")).toBe("⌘↵");
  });
});
