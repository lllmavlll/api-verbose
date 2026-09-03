import { beforeEach, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useRequestStore } from "@/lib/store/request-store";

import { RequestTabs } from "./request-tabs";

beforeEach(() => useRequestStore.getState().reset());

it("typing a query-param row updates the store URL", async () => {
  const user = userEvent.setup();
  useRequestStore.getState().setUrl("https://x.test/p");
  render(<RequestTabs />);
  const params = screen.getByRole("region", { name: "Query Params" });

  await user.type(within(params).getByPlaceholderText("Key"), "q");
  await user.type(within(params).getAllByPlaceholderText("Value")[0], "hi there");

  expect(useRequestStore.getState().spec.url).toBe(
    "https://x.test/p?q=hi%20there",
  );
});

it("toggling a query-param row off removes it from the URL", async () => {
  const user = userEvent.setup();
  useRequestStore.getState().setUrl("https://x.test/p?a=1");
  render(<RequestTabs />);
  const params = screen.getByRole("region", { name: "Query Params" });

  await user.click(within(params).getByRole("checkbox", { name: "Enable a" }));

  expect(useRequestStore.getState().spec.url).toBe("https://x.test/p");
  expect(useRequestStore.getState().spec.params[0]?.enabled).toBe(false);
});

it("shows collisions on both headers and query params", () => {
  useRequestStore.getState().loadSpec({
    method: "GET",
    url: "https://x.test/p?api_key=manual",
    headers: [
      { id: "header", key: "Authorization", value: "manual", enabled: true },
    ],
    params: [
      { id: "param", key: "api_key", value: "manual", enabled: true },
    ],
    auth: { kind: "apikey", name: "api_key", value: "real", in: "query" },
    body: { kind: "none" },
  });
  render(<RequestTabs />);

  expect(
    within(screen.getByRole("region", { name: "Query Params" })).getByText(
      /overridden by Auth/i,
    ),
  ).toBeInTheDocument();

  act(() => {
    useRequestStore.getState().setAuth({ kind: "bearer", token: "T" });
  });
  expect(
    within(screen.getByRole("region", { name: "Headers" })).getByText(
      /overridden by Auth/i,
    ),
  ).toBeInTheDocument();
});
