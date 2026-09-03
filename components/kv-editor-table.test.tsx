import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import type { KV } from "@/lib/http/types";

import { KvEditorTable } from "./kv-editor-table";

function ExplicitRowsHarness() {
  const [rows, setRows] = useState<KV[]>([
    { id: "one", key: "name", value: "Ada", enabled: true },
  ]);
  return (
    <KvEditorTable
      emptyMessage="No form fields."
      label="Form body"
      onChange={setRows}
      rows={rows}
    />
  );
}

it("edits, toggles, removes, and empties explicit key/value rows", async () => {
  const user = userEvent.setup();
  render(<ExplicitRowsHarness />);

  const table = screen.getByRole("table");
  await user.clear(within(table).getByLabelText("Form body value 1"));
  await user.type(within(table).getByLabelText("Form body value 1"), "Lovelace");
  expect(within(table).getByLabelText("Form body value 1")).toHaveValue(
    "Lovelace",
  );

  await user.click(within(table).getByRole("checkbox", { name: "Enable name" }));
  expect(within(table).getByRole("checkbox", { name: "Enable name" })).not.toBeChecked();

  await user.click(within(table).getByRole("button", { name: "Remove name" }));
  expect(screen.getByText("No form fields.")).toBeInTheDocument();
});
