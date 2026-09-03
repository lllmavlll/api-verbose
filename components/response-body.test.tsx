import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { ResponseBody } from "./response-body";

const base = {
  ok: true,
  status: 200,
  statusText: "OK",
  timeMs: 12,
  via: "direct",
  headers: [] as [string, string][],
} as const;

it("shows highlighted Pretty by default and toggles to byte-exact Raw and back", async () => {
  const user = userEvent.setup();
  render(
    <ResponseBody
      result={{
        ...base,
        body: { encoding: "utf8", text: '{"a":1}' },
        isJson: true,
        sizeBytes: 7,
        headers: [["content-type", "application/json"]],
      }}
    />,
  );

  await waitFor(() =>
    expect(document.querySelector("pre.shiki")).toBeInTheDocument(),
  );
  await user.click(screen.getByRole("tab", { name: /raw/i }));
  expect(screen.getByText('{"a":1}')).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: /pretty/i }));
  await waitFor(() =>
    expect(document.querySelector("pre.shiki")).toBeInTheDocument(),
  );
});

it("renders an HTML preview inside a locked-down iframe", async () => {
  const user = userEvent.setup();
  render(
    <ResponseBody
      result={{
        ...base,
        body: {
          encoding: "utf8",
          text: "<h1>hi<script>alert(1)</script></h1>",
        },
        isJson: false,
        sizeBytes: 40,
        headers: [["content-type", "text/html"]],
      }}
    />,
  );

  await user.click(screen.getByRole("tab", { name: /preview/i }));
  const frame = document.querySelector("iframe") as HTMLIFrameElement;
  expect(frame).toBeInTheDocument();
  expect(frame.getAttribute("sandbox") ?? "").not.toContain("allow-scripts");
  expect(frame.getAttribute("csp")).toContain("default-src 'none'");
  expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(frame).toHaveClass("pointer-events-none");
  expect(frame).toHaveAttribute("tabindex", "-1");
});

it("disables Preview for non-previewable types", () => {
  render(
    <ResponseBody
      result={{
        ...base,
        body: { encoding: "utf8", text: '{"a":1}' },
        isJson: true,
        sizeBytes: 7,
        headers: [["content-type", "application/json"]],
      }}
    />,
  );

  const preview = screen.getByRole("tab", { name: /preview/i });
  expect(preview).toHaveAttribute("aria-disabled", "true");
});

it("shows the raw-fallback banner for an over-cap body and never highlights", () => {
  render(
    <ResponseBody
      result={{
        ...base,
        body: { encoding: "utf8", text: "x".repeat(5) },
        isJson: true,
        sizeBytes: 2_000_000,
        headers: [["content-type", "application/json"]],
      }}
    />,
  );

  expect(
    screen.getByText(/large response.*highlighting off/i),
  ).toBeInTheDocument();
  expect(document.querySelector("pre.shiki")).not.toBeInTheDocument();
});

it("shows an explicit empty-response state", () => {
  render(
    <ResponseBody
      result={{
        ...base,
        body: { encoding: "utf8", text: "" },
        isJson: false,
        sizeBytes: 0,
        headers: [],
      }}
    />,
  );

  expect(screen.getByText(/empty response/i)).toBeInTheDocument();
});

it("does not dump bytes for a binary body", () => {
  render(
    <ResponseBody
      result={{
        ...base,
        body: { encoding: "base64", data: "XkBeQQ==" },
        isJson: false,
        sizeBytes: 2048,
        headers: [["content-type", "application/octet-stream"]],
      }}
    />,
  );

  expect(screen.getByText(/binary response/i)).toBeInTheDocument();
  expect(screen.queryByText("^@^A")).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /preview/i })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

it("keeps image bytes hidden in Raw while leaving Preview available", () => {
  const imageBytes = "iVBORwD/";
  render(
    <ResponseBody
      result={{
        ...base,
        body: { encoding: "base64", data: imageBytes },
        isJson: false,
        sizeBytes: 6,
        headers: [["content-type", "image/png"]],
      }}
    />,
  );

  expect(screen.getByText(/binary response/i)).toBeInTheDocument();
  expect(screen.queryByText(imageBytes)).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /preview/i })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
});

it("keeps Preview enabled for capped HTML while forcing Raw", () => {
  render(
    <ResponseBody
      result={{
        ...base,
        body: { encoding: "utf8", text: "<h1>large</h1>" },
        isJson: false,
        sizeBytes: 1_000_000,
        headers: [["content-type", "text/html"]],
      }}
    />,
  );

  expect(screen.getByText(/large response.*highlighting off/i)).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /raw/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tab", { name: /preview/i })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
});

it("never dumps capped image bytes while keeping Preview enabled", () => {
  const imageBytes = "iVBORwD/";
  render(
    <ResponseBody
      result={{
        ...base,
        body: { encoding: "base64", data: imageBytes },
        isJson: false,
        sizeBytes: 1_000_000,
        headers: [["content-type", "image/png"]],
      }}
    />,
  );

  expect(screen.getByText(/large response.*highlighting off/i)).toBeInTheDocument();
  expect(screen.getByText(/binary response/i)).toBeInTheDocument();
  expect(screen.queryByText(imageBytes)).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /preview/i })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
});

it("resets Raw back to Pretty when a new response arrives", async () => {
  const user = userEvent.setup();
  const first = {
    ...base,
    body: { encoding: "utf8" as const, text: '{"first":true}' },
    isJson: true,
    sizeBytes: 14,
    headers: [["content-type", "application/json"]] as [string, string][],
  };
  const { rerender } = render(<ResponseBody result={first} />);
  await user.click(screen.getByRole("tab", { name: /raw/i }));
  expect(screen.getByRole("tab", { name: /raw/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  rerender(
    <ResponseBody
      result={{
        ...first,
        body: { encoding: "utf8", text: '{"second":true}' },
        sizeBytes: 15,
      }}
    />,
  );

  await waitFor(() =>
    expect(screen.getByRole("tab", { name: /pretty/i })).toHaveAttribute(
      "aria-selected",
      "true",
    ),
  );
});
