import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppHeader } from "./app-header";
import { ThemeProvider } from "./theme-provider";

function renderHeader(props: { elapsedMs: number; pending: boolean }) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }),
  });

  return render(
    <ThemeProvider>
      <AppHeader {...props} />
    </ThemeProvider>,
  );
}

describe("AppHeader", () => {
  it("contains the product title, description, and theme control", () => {
    renderHeader({ elapsedMs: 0, pending: false });

    expect(screen.getByRole("banner", { name: "Verbose" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Verbose" })).toBeVisible();
    expect(screen.getByText("Local-first REST client")).toBeVisible();
    expect(
      screen.getByText(
        "Send an HTTP request and read the response without an account or cloud sync.",
      ),
    ).toBeVisible();
    const themeToggle = screen.getByRole("button", { name: /toggle theme/i });
    expect(themeToggle).toBeVisible();
    expect(themeToggle).toHaveTextContent("");
    expect(screen.queryByText(/sending/i)).not.toBeInTheDocument();
  });

  it("announces the rounded elapsed time while sending", () => {
    renderHeader({ elapsedMs: 127.6, pending: true });

    expect(screen.getByText("Sending · 128 ms")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});
