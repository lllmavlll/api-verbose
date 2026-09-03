import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { ResponseCookiesTable } from "./response-cookies-table";

it("renders one row per parsed cookie with attribute columns", () => {
  render(
    <ResponseCookiesTable
      headers={[
        [
          "set-cookie",
          "sid=abc; Domain=example.com; Path=/; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Secure; HttpOnly; SameSite=Lax",
        ],
      ]}
    />,
  );

  const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
  expect(cells[0]).toHaveTextContent("sid");
  expect(cells[1]).toHaveTextContent("abc");
  expect(cells[2]).toHaveTextContent("example.com");
  expect(cells[3]).toHaveTextContent("/");
  expect(cells[4]).toHaveTextContent("Wed, 09 Jun 2027 10:18:14 GMT");
  expect(cells[5]).toHaveTextContent("✓");
  expect(cells[6]).toHaveTextContent("✓");
  expect(cells[7]).toHaveTextContent("Lax");
});

it("renders absent flags and attributes as em dashes", () => {
  render(<ResponseCookiesTable headers={[["set-cookie", "a=1; Secure"]]} />);

  const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
  expect(cells[2]).toHaveTextContent("—");
  expect(cells[5]).toHaveTextContent("✓");
  expect(cells[6]).toHaveTextContent("—");
});

it("uses Max-Age in the expiry column when both expiry attributes exist", () => {
  render(
    <ResponseCookiesTable
      headers={[
        [
          "set-cookie",
          "a=1; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Max-Age=3600",
        ],
      ]}
    />,
  );

  const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
  expect(cells[4]).toHaveTextContent("Max-Age=3600");
  expect(cells[4]).not.toHaveTextContent("Wed, 09 Jun");
});

it("shows the relay-aware empty state when no cookies are visible", () => {
  render(
    <ResponseCookiesTable headers={[["content-type", "text/html"]]} />,
  );

  expect(screen.getByText(/no cookies set/i)).toBeInTheDocument();
  expect(screen.getByText(/relay/i)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
