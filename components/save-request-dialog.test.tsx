import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SaveRequestDialog } from "./save-request-dialog";

const collections = [{ id: "c1", name: "GitHub" }];

describe("SaveRequestDialog", () => {
  it("pre-fills the suggested name and saves it to Ungrouped by default", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <SaveRequestDialog
        collections={collections}
        defaultName="GET api.test/x"
        onCreateCollection={vi.fn()}
        onOpenChange={vi.fn()}
        onSave={onSave}
        open
      />,
    );

    expect(screen.getByRole("textbox", { name: /request name/i })).toHaveValue(
      "GET api.test/x",
    );
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledWith({
      name: "GET api.test/x",
      collectionId: null,
    });
  });

  it("disables Save when the name is only whitespace", async () => {
    const user = userEvent.setup();
    render(
      <SaveRequestDialog
        collections={collections}
        defaultName="x"
        onCreateCollection={vi.fn()}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        open
      />,
    );

    const input = screen.getByRole("textbox", { name: /request name/i });
    await user.clear(input);
    await user.type(input, "   ");

    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("can create a collection inline", async () => {
    const onCreateCollection = vi.fn();
    const user = userEvent.setup();
    render(
      <SaveRequestDialog
        collections={collections}
        defaultName="x"
        onCreateCollection={onCreateCollection}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        open
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /collection/i }));
    await user.click(
      await screen.findByRole("option", { name: /new collection/i }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /new collection name/i }),
      " Work ",
    );
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(onCreateCollection).toHaveBeenCalledWith("Work");
  });

  it("cancels without saving", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SaveRequestDialog
        collections={collections}
        defaultName="x"
        onCreateCollection={vi.fn()}
        onOpenChange={onOpenChange}
        onSave={vi.fn()}
        open
      />,
    );

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
