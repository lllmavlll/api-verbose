import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { ResponseHeadersTable } from "./response-headers-table";

it("renders one row per header sorted case-insensitively", () => {
  render(
    <ResponseHeadersTable
      headers={[
        ["X-Custom", "z"],
        ["content-type", "application/json"],
        ["Age", "10"],
      ]}
    />,
  );

  const rows = screen.getAllByRole("row").slice(1);
  expect(rows).toHaveLength(3);
  expect(within(rows[0]).getByText("Age")).toBeInTheDocument();
  expect(within(rows[1]).getByText("content-type")).toBeInTheDocument();
  expect(within(rows[2]).getByText("X-Custom")).toBeInTheDocument();
});

it("renders header values verbatim", () => {
  render(
    <ResponseHeadersTable
      headers={[["cache-control", "  no-cache, no-store  "]]}
    />,
  );

  const valueCell = screen.getAllByRole("cell")[1];
  expect(valueCell.textContent).toBe("  no-cache, no-store  ");
});

it("shows a calm empty state when no headers are available", () => {
  render(<ResponseHeadersTable headers={[]} />);

  expect(screen.getByText(/no response headers available/i)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
