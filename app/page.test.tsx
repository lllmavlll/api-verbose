import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { clearCommands } from "@/lib/commands";
import type { RequestSpec } from "@/lib/http/types";

const { sendRequest } = vi.hoisted(() => ({
  sendRequest: vi.fn(async (spec: RequestSpec) => {
    void spec;
    return {
      ok: true as const,
      status: 200,
      statusText: "OK",
      timeMs: 1,
      sizeBytes: 2,
      body: { encoding: "utf8" as const, text: "{}" },
      isJson: true,
      headers: [] as [string, string][],
    };
  }),
}));

vi.mock("@/lib/http/send-request", () => ({ sendRequest }));

import { useRequestStore } from "@/lib/store/request-store";

import Page from "./page";

beforeEach(() => {
  clearCommands();
  useRequestStore.getState().reset();
  sendRequest.mockClear();
});

it("keeps curl controls available alongside the command palette", async () => {
  const user = userEvent.setup();
  render(<Page />);

  expect(
    screen.getByRole("button", { name: /import curl/i }),
  ).toBeInTheDocument();

  await user.keyboard("{Meta>}k{/Meta}");

  expect(
    screen.getByRole("dialog", { name: /command palette/i }),
  ).toBeInTheDocument();
});

it("does not send the underlying request from the curl import dialog", async () => {
  const user = userEvent.setup();
  const originalSpec: RequestSpec = {
    method: "POST",
    url: "https://api.test/mutate",
    params: [],
    headers: [],
    auth: { kind: "basic", username: "alice", password: "secret" },
    body: {
      kind: "raw",
      text: "mutate=true",
      contentType: "application/x-www-form-urlencoded",
    },
  };
  useRequestStore.getState().loadSpec(originalSpec);
  render(<Page />);

  await user.click(screen.getByRole("button", { name: /import curl/i }));
  const input = screen.getByRole("textbox", { name: /curl command/i });
  fireEvent.keyDown(input, { key: "Enter", metaKey: true });

  expect(sendRequest).not.toHaveBeenCalled();
  expect(useRequestStore.getState().spec).toEqual(originalSpec);
  expect(
    screen.getByRole("dialog", { name: /import curl/i }),
  ).toBeInTheDocument();
});

it("uses palette method selection without discarding builder state or sending", async () => {
  const user = userEvent.setup();
  const originalSpec: RequestSpec = {
    method: "GET",
    url: "https://api.test/command?draft=kept",
    params: [
      { id: "draft", key: "draft", value: "kept", enabled: true },
    ],
    headers: [
      { id: "manual", key: "X-Manual", value: "yes", enabled: true },
    ],
    auth: { kind: "bearer", token: "T" },
    body: { kind: "json", text: '{"kept":true}' },
  };
  useRequestStore.getState().loadSpec(originalSpec);
  render(<Page />);

  await user.keyboard("{Meta>}k{/Meta}");
  await user.type(screen.getByPlaceholderText(/type a command/i), "POST");
  await user.keyboard("{Enter}");
  await waitFor(() =>
    expect(useRequestStore.getState().spec.method).toBe("POST"),
  );

  expect(useRequestStore.getState().spec).toEqual({
    ...originalSpec,
    method: "POST",
  });
  expect(sendRequest).not.toHaveBeenCalled();
});

it("composes auth into the spec handed to the send seam", async () => {
  const user = userEvent.setup();
  useRequestStore.getState().setUrl("https://httpbin.org/get");
  useRequestStore.getState().setAuth({ kind: "bearer", token: "T" });
  render(<Page />);

  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(sendRequest).toHaveBeenCalledOnce();
  expect(sendRequest.mock.calls[0]?.[0]).toMatchObject({
    url: "https://httpbin.org/get",
    auth: { kind: "none" },
    headers: [expect.objectContaining({ key: "Authorization", value: "Bearer T" })],
  });
});

it("sends only enabled named manual rows", async () => {
  const user = userEvent.setup();
  useRequestStore.getState().loadSpec({
    method: "GET",
    url: "https://x.test/p?a=1",
    params: [
      { id: "a", key: "a", value: "1", enabled: true },
      { id: "b", key: "b", value: "2", enabled: false },
    ],
    headers: [
      { id: "one", key: "X-Test", value: "yes", enabled: true },
      { id: "two", key: "X-Off", value: "no", enabled: false },
    ],
    auth: { kind: "none" },
    body: { kind: "none" },
  });
  render(<Page />);

  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(sendRequest.mock.calls[0]?.[0]).toMatchObject({
    url: "https://x.test/p?a=1",
    headers: [expect.objectContaining({ key: "X-Test", value: "yes" })],
  });
});

it("reports an incomplete percent escape instead of throwing on Send", async () => {
  const user = userEvent.setup();
  useRequestStore.getState().setUrl("https://x.test/p?a=%");
  render(<Page />);

  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(sendRequest).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(/valid.*url/i);
});
