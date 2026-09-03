import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { useRequestStore } from "@/lib/store/request-store";
import { RequestBar } from "./request-bar";

beforeEach(() => useRequestStore.getState().reset());

it("submits the default method and URL on Send", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<RequestBar pending={false} onSubmit={onSubmit} />);

  await user.type(screen.getByRole("textbox"), "https://api.test/x");
  await user.click(screen.getByRole("button", { name: /send/i }));

  expect(useRequestStore.getState().spec).toMatchObject({
    method: "GET",
    url: "https://api.test/x",
  });
  expect(onSubmit).toHaveBeenCalledOnce();
});

it("offers every supported method and submits a non-default choice", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<RequestBar pending={false} onSubmit={onSubmit} />);

  await user.click(screen.getByRole("combobox", { name: /http method/i }));
  await screen.findByRole("option", { name: "GET" });
  for (const method of [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
  ]) {
    expect(await screen.findByRole("option", { name: method })).toBeInTheDocument();
  }
  await user.click(await screen.findByRole("option", { name: "PATCH" }));
  await user.type(screen.getByRole("textbox"), "https://api.test/x");
  await user.click(screen.getByRole("button", { name: /send/i }));

  expect(useRequestStore.getState().spec).toMatchObject({
    method: "PATCH",
    url: "https://api.test/x",
  });
  expect(onSubmit).toHaveBeenCalledOnce();
});

it("blocks an invalid URL and shows a message", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<RequestBar pending={false} onSubmit={onSubmit} />);

  await user.type(screen.getByRole("textbox"), "nope");
  await user.click(screen.getByRole("button", { name: /send/i }));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText(/valid.*url/i)).toBeInTheDocument();
});

it("marks the URL input for contextual history shortcuts", () => {
  render(<RequestBar pending={false} onSubmit={vi.fn()} />);

  expect(screen.getByRole("textbox")).toHaveAttribute("data-request-url");
});

it("reconciles a valid URL query into the param rows", async () => {
  const user = userEvent.setup();
  render(<RequestBar pending={false} onSubmit={vi.fn()} />);

  await user.type(
    screen.getByRole("textbox", { name: "Request URL" }),
    "https://api.test/x?a=1&a=2",
  );

  await waitFor(() => {
    expect(
      useRequestStore
        .getState()
        .spec.params.map(({ key, value }) => [key, value]),
    ).toEqual([
      ["a", "1"],
      ["a", "2"],
    ]);
  });
});

it("disables Send while a request is pending", () => {
  render(<RequestBar pending onSubmit={vi.fn()} />);

  expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
});
