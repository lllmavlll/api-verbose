import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SavedGroup } from "@/lib/saved/saved-store";
import type { RequestSpec } from "@/lib/http/types";

import { SavedSidebar } from "./saved-sidebar";

const spec: RequestSpec = {
  method: "GET",
  url: "https://api.test/x",
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
};

function renderSidebar(
  groups: SavedGroup[],
  overrides: Partial<React.ComponentProps<typeof SavedSidebar>> = {},
) {
  const props: React.ComponentProps<typeof SavedSidebar> = {
    groups,
    onOpen: vi.fn(),
    onRenameSaved: vi.fn(),
    onMoveSaved: vi.fn(),
    onDeleteSaved: vi.fn(),
    onRenameCollection: vi.fn(),
    onDeleteCollection: vi.fn(),
    onNewCollection: vi.fn(),
    ...overrides,
  };
  render(<SavedSidebar {...props} />);
  return props;
}

describe("SavedSidebar", () => {
  it("shows the empty hint and new-collection affordance", async () => {
    const onNewCollection = vi.fn();
    const user = userEvent.setup();
    renderSidebar([{ collection: null, requests: [] }], { onNewCollection });

    expect(screen.getByText(/no saved requests yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /new collection/i }));
    expect(onNewCollection).toHaveBeenCalledOnce();
  });

  it("renders an empty collection so it survives as a visible folder", () => {
    renderSidebar([
      { collection: null, requests: [] },
      { collection: { id: "c1", name: "Empty" }, requests: [] },
    ]);

    expect(screen.getByRole("button", { name: /empty collection/i }))
      .toBeInTheDocument();
  });

  it("opens a saved request when its focusable row is clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const saved = { id: "s1", name: "zen", collectionId: null, spec };
    renderSidebar([{ collection: null, requests: [saved] }], { onOpen });

    await user.click(screen.getByRole("button", { name: /open get zen/i }));

    expect(onOpen).toHaveBeenCalledWith(saved);
  });

  it("renames a saved request with a non-empty value", async () => {
    const onRenameSaved = vi.fn();
    const user = userEvent.setup();
    const saved = { id: "s1", name: "zen", collectionId: null, spec };
    renderSidebar([{ collection: null, requests: [saved] }], {
      onRenameSaved,
    });

    await user.click(
      screen.getByRole("button", { name: /actions for saved request zen/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^rename$/i }),
    );
    const input = screen.getByRole("textbox", { name: /name/i });
    await user.clear(input);
    await user.type(input, " renamed ");
    await user.click(screen.getByRole("button", { name: /save name/i }));

    expect(onRenameSaved).toHaveBeenCalledWith("s1", "renamed");
  });

  it("deletes a saved request immediately from its row menu", async () => {
    const onDeleteSaved = vi.fn();
    const user = userEvent.setup();
    const saved = { id: "s1", name: "zen", collectionId: null, spec };
    renderSidebar([{ collection: null, requests: [saved] }], {
      onDeleteSaved,
    });

    await user.click(
      screen.getByRole("button", { name: /actions for saved request zen/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^delete$/i }),
    );

    expect(onDeleteSaved).toHaveBeenCalledWith("s1");
  });

  it("offers reassign and explicit cascade when deleting a collection", async () => {
    const onDeleteCollection = vi.fn();
    const user = userEvent.setup();
    renderSidebar(
      [
        { collection: null, requests: [] },
        { collection: { id: "c1", name: "GitHub" }, requests: [] },
      ],
      { onDeleteCollection },
    );

    await user.click(
      screen.getByRole("button", { name: /actions for collection github/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^delete$/i }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      /move.*ungrouped/i,
    );
    await user.click(
      screen.getByRole("button", { name: /move to ungrouped/i }),
    );

    expect(onDeleteCollection).toHaveBeenCalledWith("c1", "reassign");
  });

  it("renames a collection through its own action route", async () => {
    const onRenameCollection = vi.fn();
    const user = userEvent.setup();
    renderSidebar(
      [
        { collection: null, requests: [] },
        { collection: { id: "c1", name: "GitHub" }, requests: [] },
      ],
      { onRenameCollection },
    );

    await user.click(
      screen.getByRole("button", { name: /actions for collection github/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^rename$/i }),
    );
    const input = screen.getByRole("textbox", { name: /^name$/i });
    await user.clear(input);
    await user.type(input, " Platform ");
    await user.click(screen.getByRole("button", { name: /save name/i }));

    expect(onRenameCollection).toHaveBeenCalledWith("c1", "Platform");
  });

  it("routes the explicit destructive collection choice to cascade", async () => {
    const onDeleteCollection = vi.fn();
    const user = userEvent.setup();
    renderSidebar(
      [
        { collection: null, requests: [] },
        { collection: { id: "c1", name: "GitHub" }, requests: [] },
      ],
      { onDeleteCollection },
    );

    await user.click(
      screen.getByRole("button", { name: /actions for collection github/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^delete$/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /delete collection and requests/i }),
    );

    expect(onDeleteCollection).toHaveBeenCalledWith("c1", "cascade");
  });
});
