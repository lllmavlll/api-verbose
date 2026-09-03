import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { AuthPanel } from "./auth-panel";

it("renders the token field for Bearer auth", () => {
  render(
    <AuthPanel
      auth={{ kind: "bearer", token: "abc" }}
      onChange={() => undefined}
    />,
  );

  expect(screen.getByLabelText("Token")).toHaveValue("abc");
});

it("emits an updated Bearer token as the user types", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<AuthPanel auth={{ kind: "bearer", token: "" }} onChange={onChange} />);

  await user.type(screen.getByLabelText("Token"), "T");

  expect(onChange).toHaveBeenLastCalledWith({ kind: "bearer", token: "T" });
});

it("masks the Basic password field", () => {
  render(
    <AuthPanel
      auth={{ kind: "basic", username: "u", password: "p" }}
      onChange={() => undefined}
    />,
  );

  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
});

it("shows API-key name, value, and location controls", () => {
  render(
    <AuthPanel
      auth={{ kind: "apikey", name: "X-Key", value: "k", in: "header" }}
      onChange={() => undefined}
    />,
  );

  expect(screen.getByLabelText("API key name")).toHaveValue("X-Key");
  expect(screen.getByLabelText("API key value")).toHaveValue("k");
  expect(screen.getByRole("tab", { name: "Header" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
