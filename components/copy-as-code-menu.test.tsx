import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRequestStore } from "@/lib/store/request-store";

import { CopyAsCodeMenu } from "./copy-as-code-menu";

beforeEach(() => {
  useRequestStore.getState().reset();
});

function setClipboard(writeText?: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

describe("CopyAsCodeMenu", () => {
  it("writes the selected curl snippet to the clipboard", async () => {
    useRequestStore.getState().setUrl("https://api.test/x");
    const writeText = vi.fn(async () => undefined);
    const user = userEvent.setup();
    setClipboard(writeText);
    render(<CopyAsCodeMenu />);

    await user.click(screen.getByRole("button", { name: /copy as/i }));
    await user.click(await screen.findByRole("menuitem", { name: /^curl$/i }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/^curl -X GET 'https:\/\/api\.test\/x'/),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Copied as curl");
  });

  it("opens and copies through ArrowDown and Enter", async () => {
    useRequestStore.getState().setUrl("https://api.test/x");
    const writeText = vi.fn(async () => undefined);
    const user = userEvent.setup();
    setClipboard(writeText);
    render(<CopyAsCodeMenu />);

    screen.getByRole("button", { name: /copy as/i }).focus();
    await user.keyboard("{ArrowDown}");
    expect(
      await screen.findByRole("menuitem", { name: "curl" }),
    ).toHaveAttribute("data-highlighted");
    await user.keyboard("{Enter}");

    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^curl /));
    expect(screen.getByRole("status")).toHaveTextContent("Copied as curl");
  });

  it("shows a non-crashing fallback when Clipboard is unavailable", async () => {
    useRequestStore.getState().setUrl("https://api.test/x");
    const user = userEvent.setup();
    setClipboard();
    render(<CopyAsCodeMenu />);

    await user.click(screen.getByRole("button", { name: /copy as/i }));
    await user.click(await screen.findByRole("menuitem", { name: /^curl$/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /clipboard unavailable/i,
    );
  });

  it("shows the same fallback when Clipboard rejects", async () => {
    useRequestStore.getState().setUrl("https://api.test/x");
    const user = userEvent.setup();
    setClipboard(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    render(<CopyAsCodeMenu />);

    await user.click(screen.getByRole("button", { name: /copy as/i }));
    await user.click(await screen.findByRole("menuitem", { name: /^curl$/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /clipboard unavailable/i,
    );
  });

  it("is disabled while the request URL is empty", () => {
    render(<CopyAsCodeMenu />);
    expect(screen.getByRole("button", { name: /copy as/i })).toBeDisabled();
  });
});
