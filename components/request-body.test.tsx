import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useRequestStore } from "@/lib/store/request-store";

vi.mock("@/components/ui/code-editor", () => ({
  CodeEditor: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  ),
}));

import { RequestBody } from "./request-body";

beforeEach(() => useRequestStore.getState().reset());

describe("RequestBody", () => {
  it("hides editors while the type is none", () => {
    render(<RequestBody />);

    expect(screen.queryByLabelText(/json body/i)).not.toBeInTheDocument();
    expect(useRequestStore.getState().spec.body).toEqual({ kind: "none" });
  });

  it("reveals the JSON editor and writes its text into the shared store", async () => {
    const user = userEvent.setup();
    render(<RequestBody />);

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.change(screen.getByLabelText("JSON body"), {
      target: { value: '{"a":1}' },
    });

    expect(useRequestStore.getState().spec.body).toEqual({
      kind: "json",
      text: '{"a":1}',
    });
  });

  it("shows an invalid JSON hint without clearing or blocking the draft", async () => {
    const user = userEvent.setup();
    render(<RequestBody />);

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.change(screen.getByLabelText("JSON body"), {
      target: { value: "{bad" },
    });

    expect(screen.getByText(/invalid json/i)).toBeInTheDocument();
    expect(screen.getByLabelText("JSON body")).toHaveValue("{bad");
    expect(useRequestStore.getState().spec.body).toEqual({
      kind: "json",
      text: "{bad",
    });
  });

  it("treats whitespace-only JSON as empty instead of promising it will send", async () => {
    const user = userEvent.setup();
    render(<RequestBody />);

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.change(screen.getByLabelText("JSON body"), {
      target: { value: "   " },
    });

    expect(screen.queryByText(/invalid json/i)).not.toBeInTheDocument();
  });

  it("adds, updates, toggles, and removes a form row", async () => {
    const user = userEvent.setup();
    render(<RequestBody />);

    await user.click(screen.getByRole("tab", { name: "Form" }));
    await user.click(screen.getByRole("button", { name: /add field/i }));
    const form = screen.getByRole("region", { name: "Form body" });
    await user.type(within(form).getByPlaceholderText("Key"), "a");
    await user.type(within(form).getByPlaceholderText("Value"), "1");

    let body = useRequestStore.getState().spec.body;
    expect(body).toMatchObject({
      kind: "form",
      fields: [{ key: "a", value: "1", enabled: true }],
    });

    await user.click(within(form).getByRole("checkbox", { name: /enable a/i }));
    body = useRequestStore.getState().spec.body;
    expect(body).toMatchObject({
      kind: "form",
      fields: [{ key: "a", value: "1", enabled: false }],
    });

    await user.click(within(form).getByRole("button", { name: /remove a/i }));
    expect(useRequestStore.getState().spec.body).toEqual({
      kind: "form",
      fields: [],
    });
  });

  it("keeps each editor draft when switching types", async () => {
    const user = userEvent.setup();
    render(<RequestBody />);

    await user.click(screen.getByRole("tab", { name: "Raw" }));
    await user.type(screen.getByLabelText("Raw body"), "keep me");
    await user.type(screen.getByLabelText("Raw Content-Type"), "/csv");
    await user.click(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.change(screen.getByLabelText("JSON body"), {
      target: { value: "{}" },
    });
    await user.click(screen.getByRole("tab", { name: "Raw" }));

    expect(screen.getByLabelText("Raw body")).toHaveValue("keep me");
    expect(screen.getByLabelText("Raw Content-Type")).toHaveValue(
      "text/plain/csv",
    );
    expect(useRequestStore.getState().spec.body).toEqual({
      kind: "raw",
      text: "keep me",
      contentType: "text/plain/csv",
    });
  });

  it("shows the body-not-sent note on a disallowed method", async () => {
    const user = userEvent.setup();
    useRequestStore.getState().setMethod("GET");
    render(<RequestBody />);

    await user.click(screen.getByRole("tab", { name: "JSON" }));

    expect(screen.getByText(/body not sent for GET/i)).toBeInTheDocument();
  });
});
