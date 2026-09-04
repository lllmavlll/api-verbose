import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/db", () => ({
  putRule: vi.fn(async () => {}),
  getRulesFor: vi.fn(async () => []),
  deleteRule: vi.fn(async () => {}),
}));

import type { AssertionRule } from "@/lib/assert/types";
import type { SendResult } from "@/lib/http/types";
import { useAssertionsStore } from "@/lib/store/assertions-store";

import { TestsPanel } from "./tests-panel";

const success: SendResult = {
  ok: true,
  via: "direct",
  status: 200,
  statusText: "OK",
  timeMs: 128,
  sizeBytes: 19,
  body: { encoding: "utf8", text: '{"roles":["admin"]}' },
  isJson: true,
  headers: [["content-type", "application/json"]],
};

const statusRule = (
  id: string,
  expected: string,
): AssertionRule => ({
  id,
  requestRef: "request-1",
  kind: "status",
  operator: "==",
  expected,
});

beforeEach(() => {
  useAssertionsStore.setState({ rules: [], requestRef: "request-1" });
  vi.clearAllMocks();
});

describe("TestsPanel", () => {
  it("shows an empty-state hint and Add rule affordance", () => {
    render(<TestsPanel result={null} />);

    expect(screen.getByText(/no tests yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add rule/i }),
    ).toBeInTheDocument();
  });

  it("adds a rule through the editor", async () => {
    const user = userEvent.setup();
    render(<TestsPanel result={null} />);

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() =>
      expect(useAssertionsStore.getState().rules).toHaveLength(1),
    );
    const row = screen.getByTestId("rule-row");
    expect(within(row).getByLabelText(/kind/i)).toBeInTheDocument();
    expect(within(row).getByLabelText(/operator/i)).toBeInTheDocument();
    expect(within(row).getByLabelText(/expected/i)).toBeInTheDocument();
  });

  it("summarizes pass and failure counts after a completed send", () => {
    useAssertionsStore.setState({
      requestRef: "request-1",
      rules: [statusRule("passing", "200"), statusRule("failing", "500")],
    });

    render(<TestsPanel result={success} />);

    expect(screen.getByText(/tests · 1 passed · 1 failed/i)).toBeInTheDocument();
    expect(
      screen.getByText("2 total", { selector: "[data-slot=badge]" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Passed assertion")).toBeInTheDocument();
    expect(screen.getByLabelText("Failed assertion")).toBeInTheDocument();
  });

  it("shows actual versus expected on a failing row", () => {
    useAssertionsStore.setState({
      requestRef: "request-1",
      rules: [statusRule("failing", "500")],
    });

    render(<TestsPanel result={success} />);

    expect(screen.getByText(/got 200 · expected 500/i)).toBeInTheDocument();
  });

  it("shows a not-run state when the request did not complete", () => {
    useAssertionsStore.setState({
      requestRef: "request-1",
      rules: [statusRule("pending", "200")],
    });

    render(
      <TestsPanel
        result={{ ok: false, kind: "network", message: "offline" }}
      />,
    );

    expect(
      screen.getByText(/not run — request did not complete/i),
    ).toBeInTheDocument();
  });

  it("reports JSONPath evaluation errors as failed rows", () => {
    useAssertionsStore.setState({
      requestRef: "request-1",
      rules: [
        {
          id: "jsonpath",
          requestRef: "request-1",
          kind: "jsonpath",
          operator: "==",
          path: "$.missing",
          expected: "owner",
        },
      ],
    });

    render(<TestsPanel result={success} />);

    expect(
      screen.getByText(
        /no match for .* · got unavailable · expected owner/i,
      ),
    ).toBeInTheDocument();
  });
});
