import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { CodeEditor } from "./code-editor";

it("mounts and renders the initial value inside the labelled host", async () => {
  render(
    <CodeEditor
      ariaLabel="JSON body"
      language="json"
      onChange={vi.fn()}
      value={'{"a":1}'}
    />,
  );

  const host = screen.getByLabelText("JSON body");
  await waitFor(() => expect(host.textContent).toContain('{"a":1}'));
});

it("reconciles an externally changed value", async () => {
  const { rerender } = render(
    <CodeEditor
      ariaLabel="Raw body"
      language="text"
      onChange={vi.fn()}
      value="first"
    />,
  );

  rerender(
    <CodeEditor
      ariaLabel="Raw body"
      language="text"
      onChange={vi.fn()}
      value="second"
    />,
  );

  await waitFor(() =>
    expect(screen.getByLabelText("Raw body").textContent).toContain("second"),
  );
});
