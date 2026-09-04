import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { ResponsePanel } from "./response-panel";

const ok = {
  ok: true,
  status: 200,
  statusText: "OK",
  timeMs: 128,
  via: "direct",
  sizeBytes: 1400,
  body: { encoding: "utf8", text: '{"a":1}' } as const,
  isJson: true,
  headers: [["content-type", "application/json"]] as [string, string][],
} as const;

it("renders the meta bar with status, time, size and content-type", () => {
  render(<ResponsePanel pending={false} result={ok} />);

  expect(screen.getByText(/200/)).toBeInTheDocument();
  expect(screen.getByText(/128 ms/)).toBeInTheDocument();
  expect(screen.getByText(/1\.4 KB/)).toBeInTheDocument();
  expect(screen.getByText(/application\/json/)).toBeInTheDocument();
});

it("renders a redirect chain when hops are present", () => {
  render(
    <ResponsePanel
      pending={false}
      result={{
        ...ok,
        redirects: [
          { url: "https://api.test/start", status: 0 },
          { url: "https://api.test/final", status: 200 },
        ],
      }}
    />,
  );

  expect(screen.getByText(/https:\/\/api\.test\/start/)).toBeInTheDocument();
  expect(screen.getByText(/https:\/\/api\.test\/final/)).toBeInTheDocument();
  expect(screen.getByText(/redirected from/i)).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Redirect chain" })).queryByText(
      /^0$/,
    ),
  ).not.toBeInTheDocument();
});

it("shows the walking-skeleton idle hint when there is no result", () => {
  render(<ResponsePanel pending={false} result={null} />);

  expect(screen.getByText(/send a request/i)).toBeInTheDocument();
});
