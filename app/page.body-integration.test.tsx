import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

import { clearCommands } from "@/lib/commands";
import { useRequestStore } from "@/lib/store/request-store";

import Page from "./page";

const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return new Response('{"accepted":true}', {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
);

beforeEach(() => {
  clearCommands();
  useRequestStore.getState().reset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

it("sends the typed body once through the global shortcut from CodeMirror", async () => {
  useRequestStore.getState().loadSpec({
    method: "POST",
    url: "https://x.test/body",
    params: [],
    headers: [],
    auth: { kind: "none" },
    body: { kind: "json", text: '{"command":true}' },
  });
  render(<Page />);

  const editor = await waitFor(() => {
    const content = document.querySelector<HTMLElement>(".cm-content");
    expect(content).not.toBeNull();
    return content!;
  });
  fireEvent.keyDown(editor, { key: "Enter", metaKey: true });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("https://x.test/body");
  expect(init).toMatchObject({ method: "POST", body: '{"command":true}' });
  expect(new Headers(init?.headers).get("content-type")).toBe(
    "application/json",
  );
});
