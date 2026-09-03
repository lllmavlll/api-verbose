import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";

import { useActiveTheme } from "./use-active-theme";

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
});

it("defaults to dark when no theme is set", () => {
  const { result } = renderHook(() => useActiveTheme());

  expect(result.current).toBe("dark");
});

it("reads the theme sibling writes on html and reacts to changes", async () => {
  document.documentElement.setAttribute("data-theme", "light");
  const { result } = renderHook(() => useActiveTheme());

  expect(result.current).toBe("light");
  act(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await waitFor(() => expect(result.current).toBe("dark"));
});
