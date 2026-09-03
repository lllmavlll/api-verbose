import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { ResponsePanel } from "./response-panel";

it("renders a status line and pretty JSON on success", async () => {
  render(
    <ResponsePanel
      pending={false}
      result={{
        ok: true,
        via: "direct",
        status: 200,
        statusText: "OK",
        timeMs: 128,
        sizeBytes: 1400,
        body: { encoding: "utf8", text: '{"a":1}' },
        isJson: true,
        headers: [],
      }}
    />,
  );

  expect(screen.getByText(/200 OK/)).toBeInTheDocument();
  expect(screen.getByText(/200 OK/)).toHaveClass("text-status-success");
  expect(screen.getByText(/200 OK/)).not.toHaveClass("text-method-get");
  expect(screen.getByText(/128 ms/)).toBeInTheDocument();
  expect(screen.getByText(/1.4 KB/)).toBeInTheDocument();
  await waitFor(() =>
    expect(document.querySelector("pre.shiki")).toHaveTextContent(/"a": 1/),
  );
});

it("renders the failure message", () => {
  render(
    <ResponsePanel
      pending={false}
      result={{ ok: false, kind: "network", message: "request failed" }}
    />,
  );

  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByText(/request failed/i)).toBeInTheDocument();
});

it("renders distinct idle and loading states", () => {
  const { rerender } = render(
    <ResponsePanel pending={false} result={null} />,
  );
  expect(screen.getByText(/send a request/i)).toBeInTheDocument();

  rerender(<ResponsePanel pending result={null} />);
  expect(screen.getByText(/waiting for a response/i)).toBeInTheDocument();
});

const success = {
  ok: true as const,
  status: 200,
  statusText: "OK",
  timeMs: 12,
  sizeBytes: 7,
  body: { encoding: "utf8" as const, text: '{"a":1}' },
  isJson: true,
  headers: [] as [string, string][],
};

it("shows a via relay indicator for a relay-served response", () => {
  render(
    <ResponsePanel
      pending={false}
      result={{ ...success, via: "relay" }}
    />,
  );

  expect(screen.getByText(/via relay/i)).toBeInTheDocument();
});

it("does not show a relay indicator for a direct response", () => {
  render(
    <ResponsePanel
      pending={false}
      result={{ ...success, via: "direct" }}
    />,
  );

  expect(screen.queryByText(/via relay/i)).not.toBeInTheDocument();
});

const tabSuccess = {
  ...success,
  via: "relay" as const,
  headers: [
    ["content-type", "application/json"],
    ["set-cookie", "sid=abc; Path=/; HttpOnly"],
  ] as [string, string][],
};

it("labels response Headers and Cookies tabs with row counts", () => {
  render(<ResponsePanel pending={false} result={tabSuccess} />);

  const responseViews = screen.getByRole("tablist", {
    name: "Response data views",
  });
  expect(
    within(responseViews).getByRole("tab", { name: "Headers 2" }),
  ).toBeInTheDocument();
  expect(
    within(responseViews).getByRole("tab", { name: "Cookies 1" }),
  ).toBeInTheDocument();
});

it("shows headers and parsed cookies in their response tabs", async () => {
  const user = userEvent.setup();
  render(<ResponsePanel pending={false} result={tabSuccess} />);

  const responseViews = screen.getByRole("tablist", {
    name: "Response data views",
  });
  await user.click(
    within(responseViews).getByRole("tab", { name: "Headers 2" }),
  );
  expect(screen.getByText("content-type")).toBeInTheDocument();

  await user.click(
    within(responseViews).getByRole("tab", { name: "Cookies 1" }),
  );
  expect(screen.getByText("sid")).toBeInTheDocument();
  expect(screen.getByText("abc")).toBeInTheDocument();
});

it("labels Cookies 0 and shows the empty state when none are visible", async () => {
  const user = userEvent.setup();
  render(
    <ResponsePanel
      pending={false}
      result={{
        ...success,
        via: "direct",
        headers: [["content-type", "text/html"]],
      }}
    />,
  );

  const cookiesTab = screen.getByRole("tab", { name: "Cookies 0" });
  await user.click(cookiesTab);
  expect(screen.getByText(/no cookies set/i)).toBeInTheDocument();
  expect(screen.getByText(/browser may hide set-cookie/i)).toBeInTheDocument();
});
