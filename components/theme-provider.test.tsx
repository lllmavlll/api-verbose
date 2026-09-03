import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const providerSpy = vi.fn();

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children, ...props }: { children: React.ReactNode }) => {
    providerSpy(props);
    return <div data-testid="next-themes-provider">{children}</div>;
  },
  useTheme: vi.fn(),
}));

import { ThemeProvider } from "./theme-provider";

beforeEach(() => providerSpy.mockClear());

it("configures the system-aware no-flash theme provider", () => {
  render(
    <ThemeProvider>
      <span>app</span>
    </ThemeProvider>,
  );

  expect(screen.getByText("app")).toBeInTheDocument();
  expect(providerSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      attribute: "class",
      defaultTheme: "system",
      disableTransitionOnChange: true,
      enableSystem: true,
      storageKey: "verbose-theme",
    }),
  );
});
