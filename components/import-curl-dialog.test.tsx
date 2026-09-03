import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useRequestStore } from "@/lib/store/request-store";

import { ImportCurlDialog } from "./import-curl-dialog";

beforeEach(() => useRequestStore.getState().reset());

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /import curl/i }));
}

describe("ImportCurlDialog", () => {
  it("loads a pasted curl command into the live request store", async () => {
    const user = userEvent.setup();
    render(<ImportCurlDialog />);
    await openDialog(user);
    await user.type(
      screen.getByRole("textbox", { name: /curl command/i }),
      'curl https://api.test/x -H "Accept: application/json"',
    );
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(useRequestStore.getState().spec).toMatchObject({
      method: "GET",
      url: "https://api.test/x",
      headers: [
        { key: "Accept", value: "application/json", enabled: true },
      ],
    });
    expect(
      screen.queryByRole("dialog", { name: /import curl/i }),
    ).not.toBeInTheDocument();
  });

  it("shows an inline error and preserves the request on a bad paste", async () => {
    useRequestStore.getState().setUrl("https://keep.test/x");
    const user = userEvent.setup();
    render(<ImportCurlDialog />);
    await openDialog(user);
    await user.type(
      screen.getByRole("textbox", { name: /curl command/i }),
      "curl https://api.test/x -H 'oops",
    );
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(screen.getByText(/unterminated quote/i)).toBeInTheDocument();
    expect(useRequestStore.getState().spec.url).toBe("https://keep.test/x");
  });

  it("shows an inline error and preserves the request on an empty paste", async () => {
    useRequestStore.getState().setUrl("https://keep.test/x");
    const user = userEvent.setup();
    render(<ImportCurlDialog />);
    await openDialog(user);
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/paste a curl/i);
    expect(useRequestStore.getState().spec.url).toBe("https://keep.test/x");
  });

  it("lists every ignored flag after a successful import", async () => {
    const user = userEvent.setup();
    render(<ImportCurlDialog />);
    await openDialog(user);
    await user.type(
      screen.getByRole("textbox", { name: /curl command/i }),
      "curl https://api.test/x --compressed -k",
    );
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Ignored 2 flags");
    expect(screen.getByRole("alert")).toHaveTextContent("--compressed, -k");
  });
});
