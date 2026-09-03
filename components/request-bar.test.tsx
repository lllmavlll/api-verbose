import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { RequestBar } from "./request-bar";

it("submits the default method and URL on Send", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<RequestBar pending={false} onSubmit={onSubmit} />);

  await user.type(screen.getByRole("textbox"), "https://api.test/x");
  await user.click(screen.getByRole("button", { name: /send/i }));

  expect(onSubmit).toHaveBeenCalledWith({
    method: "GET",
    url: "https://api.test/x",
  });
});

it("offers every supported method and submits a non-default choice", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<RequestBar pending={false} onSubmit={onSubmit} />);

  fireEvent.click(screen.getByRole("combobox", { name: /http method/i }));
  for (const method of [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
  ]) {
    expect(screen.getByRole("option", { name: method })).toBeInTheDocument();
  }
  await user.click(screen.getByRole("option", { name: "PATCH" }));
  await user.type(screen.getByRole("textbox"), "https://api.test/x");
  await user.click(screen.getByRole("button", { name: /send/i }));

  expect(onSubmit).toHaveBeenCalledWith({
    method: "PATCH",
    url: "https://api.test/x",
  });
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

it("submits with Control+Enter", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<RequestBar pending={false} onSubmit={onSubmit} />);

  await user.type(screen.getByRole("textbox"), "https://api.test/x");
  await user.keyboard("{Control>}{Enter}{/Control}");

  expect(onSubmit).toHaveBeenCalledOnce();
});

it("disables Send while a request is pending", () => {
  render(<RequestBar pending onSubmit={vi.fn()} />);

  expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
});
