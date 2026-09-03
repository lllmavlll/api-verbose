import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { ResponsePanel } from "./response-panel";

it("renders a status line and pretty JSON on success", () => {
  render(
    <ResponsePanel
      pending={false}
      result={{
        ok: true,
        status: 200,
        statusText: "OK",
        timeMs: 128,
        sizeBytes: 1400,
        bodyText: '{"a":1}',
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
  expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
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
