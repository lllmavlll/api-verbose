import "fake-indexeddb/auto";

import { beforeEach, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { clearCommands } from "@/lib/commands";
import { db, getRulesFor, putRule } from "@/lib/db/db";
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
import { useAssertionsStore } from "@/lib/store/assertions-store";

import Page from "./page";

const realLoadRules = useAssertionsStore.getState().loadRules;

beforeEach(async () => {
  clearCommands();
  useRequestStore.getState().reset();
  sendRequest.mockClear();
  vi.restoreAllMocks();
  await db.savedRequests.clear();
  await db.collections.clear();
  await db.assertions.clear();
  useAssertionsStore.setState({
    requestRef: "draft",
    rules: [],
    loadRules: realLoadRules,
  });
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

it("surfaces a saved-request write failure and preserves the workbench", async () => {
  const spec: RequestSpec = {
    method: "POST",
    url: "https://keep.test/request",
    params: [],
    headers: [
      { id: "secret", key: "Authorization", value: "Bearer T", enabled: true },
    ],
    auth: { kind: "bearer", token: "T" },
    body: { kind: "none" },
  };
  useRequestStore.getState().loadSpec(spec);
  vi.spyOn(db.savedRequests, "put").mockRejectedValueOnce(
    new DOMException("Quota exceeded", "QuotaExceededError"),
  );
  const user = userEvent.setup();
  render(<Page />);

  await user.click(screen.getByRole("button", { name: /save request/i }));
  const dialog = screen.getByRole("dialog", { name: /save request/i });
  await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

  expect(await screen.findByText(/saved requests are unavailable/i))
    .toBeInTheDocument();
  expect(useRequestStore.getState().spec).toEqual(spec);
  expect(dialog).toBeInTheDocument();
});

it("saves the active rules with a request and restores them when it opens", async () => {
  const rule = {
    id: "draft-rule",
    requestRef: "draft",
    kind: "status" as const,
    operator: "==" as const,
    expected: "200",
  };
  await putRule(rule);
  useAssertionsStore.setState({ requestRef: "draft", rules: [rule] });
  useRequestStore.getState().setUrl("https://saved.test/asserted");
  const user = userEvent.setup();
  render(<Page />);

  await user.click(screen.getByRole("button", { name: /save request/i }));
  await user.click(
    within(screen.getByRole("dialog", { name: /save request/i })).getByRole(
      "button",
      { name: /^save$/i },
    ),
  );

  let savedId = "";
  await waitFor(async () => {
    const [saved] = await db.savedRequests.toArray();
    expect(saved).toBeDefined();
    savedId = saved.id;
    expect(await getRulesFor(saved.id)).toEqual([
      expect.objectContaining({ expected: "200", requestRef: saved.id }),
    ]);
  });

  await useAssertionsStore
    .getState()
    .updateRule("draft-rule", { expected: "500" });
  await user.click(
    screen.getByRole("button", { name: /open get get saved\.test\/asserted/i }),
  );
  await user.click(screen.getByRole("tab", { name: /tests/i }));

  await waitFor(() => {
    expect(useAssertionsStore.getState().requestRef).toBe(savedId);
    expect(
      screen.getByRole("textbox", { name: "Expected value" }),
    ).toHaveValue("200");
  });
});

it("keeps the newest saved request when overlapping rule loads finish out of order", async () => {
  let resolveFirst!: (applied: boolean) => void;
  let resolveSecond!: (applied: boolean) => void;
  const loadRules = vi.fn((requestRef: string) => {
    return new Promise<boolean>((resolve) => {
      if (requestRef === "saved-first") resolveFirst = resolve;
      if (requestRef === "saved-second") resolveSecond = resolve;
    });
  });
  useAssertionsStore.setState({ loadRules });
  await db.savedRequests.bulkPut([
    {
      id: "saved-first",
      name: "First",
      collectionId: null,
      spec: {
        method: "GET",
        url: "https://saved.test/first",
        params: [],
        headers: [],
        auth: { kind: "none" },
        body: { kind: "none" },
      },
    },
    {
      id: "saved-second",
      name: "Second",
      collectionId: null,
      spec: {
        method: "GET",
        url: "https://saved.test/second",
        params: [],
        headers: [],
        auth: { kind: "none" },
        body: { kind: "none" },
      },
    },
  ]);
  const user = userEvent.setup();
  render(<Page />);

  const first = await screen.findByRole("button", { name: /open get first/i });
  const second = screen.getByRole("button", { name: /open get second/i });
  await user.click(first);
  await user.click(second);
  resolveSecond(true);
  await waitFor(() =>
    expect(useRequestStore.getState().spec.url).toBe(
      "https://saved.test/second",
    ),
  );
  await act(async () => {
    resolveFirst(false);
    await Promise.resolve();
  });

  expect(useRequestStore.getState().spec.url).toBe(
    "https://saved.test/second",
  );
});
