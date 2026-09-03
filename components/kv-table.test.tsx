import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import type { KV } from "@/lib/http/types";

import { KvTable } from "./kv-table";

function Harness() {
  const [rows, setRows] = React.useState<KV[]>([]);
  return <KvTable label="Query Params" rows={rows} onChange={setRows} />;
}

it("materializes a new trailing draft as soon as the draft is typed into", async () => {
  const user = userEvent.setup();
  render(<Harness />);

  expect(screen.getAllByPlaceholderText("Key")).toHaveLength(1);
  await user.type(screen.getByPlaceholderText("Key"), "a");
  expect(screen.getAllByPlaceholderText("Key")).toHaveLength(2);
});

it("marks a row overridden by Auth", () => {
  const rows: KV[] = [
    { id: "1", key: "Authorization", value: "x", enabled: true },
  ];

  render(
    <KvTable
      label="Headers"
      rows={rows}
      onChange={() => undefined}
      overriddenKeys={["authorization"]}
    />,
  );

  expect(screen.getByText(/overridden by Auth/i)).toBeInTheDocument();
});

it("toggling the enable checkbox emits the flipped row", async () => {
  const user = userEvent.setup();
  let latest: KV[] = [];
  const rows: KV[] = [{ id: "1", key: "a", value: "1", enabled: true }];

  render(
    <KvTable
      label="Query Params"
      rows={rows}
      onChange={(next) => {
        latest = next;
      }}
    />,
  );
  await user.click(screen.getByRole("checkbox", { name: /enable a/i }));

  expect(latest[0].enabled).toBe(false);
});

it("removes an existing row when both fields are cleared and blurred", async () => {
  const user = userEvent.setup();
  function ExistingRowHarness() {
    const [rows, setRows] = React.useState<KV[]>([
      { id: "1", key: "a", value: "", enabled: true },
    ]);
    return <KvTable label="Query Params" rows={rows} onChange={setRows} />;
  }

  render(<ExistingRowHarness />);
  const key = screen.getAllByPlaceholderText("Key")[0];
  await user.clear(key);
  await user.tab();

  expect(screen.getAllByPlaceholderText("Key")).toHaveLength(1);
});
