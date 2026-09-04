import "fake-indexeddb/auto";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KeyboardProvider } from "@/components/keyboard-provider";
import { RequestBar } from "@/components/request-bar";
import { clearCommands } from "@/lib/commands";
import { db, putRule } from "@/lib/db/db";
import { addEntry } from "@/lib/db/history";
import { logSend } from "@/lib/db/log-send";
import {
  getHistoryStorageStatus,
  resetHistoryStorageStatus,
} from "@/lib/db/storage-status";
import type { RequestSpec, SendResult } from "@/lib/http/types";
import { useAssertionsStore } from "@/lib/store/assertions-store";
import { useRequestStore } from "@/lib/store/request-store";

import { HistoryPanel } from "./history-panel";

const realLoadRules = useAssertionsStore.getState().loadRules;

const spec = (url: string, method: RequestSpec["method"] = "GET"): RequestSpec => ({
  method,
  url,
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
});

const ok: SendResult = {
  ok: true,
  via: "direct",
  status: 200,
  statusText: "OK",
  timeMs: 5,
  sizeBytes: 3,
  body: { encoding: "utf8", text: "" },
  isJson: false,
  headers: [],
};

beforeEach(async () => {
  clearCommands();
  useRequestStore.getState().reset();
  await db.history.clear();
  await db.assertions.clear();
  useAssertionsStore.setState({
    requestRef: "draft",
    rules: [],
    loadRules: realLoadRules,
  });
  resetHistoryStorageStatus();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  db.close();
  await db.open();
  resetHistoryStorageStatus();
});

describe("HistoryPanel", () => {
  it("lists stored entries newest-first", async () => {
    await addEntry(spec("https://a.test/first"), ok, 1_000);
    await addEntry(spec("https://a.test/second"), ok, 2_000);

    render(<HistoryPanel />);

    const rows = await screen.findAllByTestId("history-row");
    expect(rows[0]).toHaveTextContent("https://a.test/second");
    expect(rows[1]).toHaveTextContent("https://a.test/first");
  });

  it("replay clears stale request fields and restores only method and URL", async () => {
    const user = userEvent.setup();
    await addEntry(spec("https://a.test/replay", "POST"), ok, 1_000);
    useRequestStore.getState().loadSpec({
      ...spec("https://a.test/current", "PATCH"),
      headers: [
        { id: "secret", key: "Authorization", value: "Bearer T", enabled: true },
      ],
      auth: { kind: "bearer", token: "T" },
      body: { kind: "raw", text: "secret", contentType: "text/plain" },
    });

    render(<HistoryPanel />);
    await user.click(await screen.findByRole("button", { name: /replay post/i }));

    expect(useRequestStore.getState().spec).toEqual({
      method: "POST",
      url: "https://a.test/replay",
      headers: [],
      params: [],
      auth: { kind: "none" },
      body: { kind: "none" },
    });
  });

  it("replay restores only the assertion rules attached to that request", async () => {
    const user = userEvent.setup();
    const first = await addEntry(spec("https://a.test/first"), ok, 1_000);
    const second = await addEntry(spec("https://a.test/second"), ok, 2_000);
    await putRule({
      id: "first-rule",
      requestRef: first.id,
      kind: "status",
      operator: "==",
      expected: "200",
    });
    await putRule({
      id: "second-rule",
      requestRef: second.id,
      kind: "status",
      operator: "==",
      expected: "201",
    });

    render(<HistoryPanel />);
    await user.click(
      await screen.findByRole("button", {
        name: /replay get https:\/\/a\.test\/first/i,
      }),
    );

    await waitFor(() =>
      expect(useAssertionsStore.getState()).toMatchObject({
        requestRef: first.id,
        rules: [expect.objectContaining({ id: "first-rule", expected: "200" })],
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: /replay get https:\/\/a\.test\/second/i,
      }),
    );
    await waitFor(() =>
      expect(useAssertionsStore.getState()).toMatchObject({
        requestRef: second.id,
        rules: [expect.objectContaining({ id: "second-rule", expected: "201" })],
      }),
    );
  });

  it("keeps the current request and rules when replay persistence is unavailable", async () => {
    const user = userEvent.setup();
    await addEntry(spec("https://a.test/replay"), ok, 1_000);
    const current = spec("https://a.test/current", "PATCH");
    const currentRule = {
      id: "current-rule",
      requestRef: "current",
      kind: "status" as const,
      operator: "==" as const,
      expected: "200",
    };
    useRequestStore.getState().loadSpec(current);
    useAssertionsStore.setState({
      requestRef: "current",
      rules: [currentRule],
      loadRules: vi.fn().mockRejectedValue(new Error("storage unavailable")),
    });

    render(<HistoryPanel />);
    await user.click(await screen.findByRole("button", { name: /replay get/i }));
    await waitFor(() =>
      expect(getHistoryStorageStatus().readUnavailable).toBe(true),
    );

    expect(useRequestStore.getState().spec).toEqual(current);
    expect(useAssertionsStore.getState()).toMatchObject({
      requestRef: "current",
      rules: [currentRule],
    });
  });

  it("shows distinct initial-empty and search-no-match states", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<HistoryPanel />);
    expect(await screen.findByText(/requests will appear here/i)).toBeInTheDocument();
    unmount();

    await addEntry(spec("https://a.test/users"), ok, 1_000);
    render(<HistoryPanel />);
    await user.type(await screen.findByRole("searchbox"), "zzz");
    expect(await screen.findByText(/no matching requests/i)).toBeInTheDocument();
  });

  it("clears history only after confirmation", async () => {
    const user = userEvent.setup();
    await addEntry(spec("https://a.test/x"), ok, 1_000);
    render(<HistoryPanel />);

    await user.click(await screen.findByRole("button", { name: /^clear$/i }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(await db.history.count()).toBe(1);

    await user.click(screen.getByRole("button", { name: /^clear history$/i }));
    await waitFor(async () => expect(await db.history.count()).toBe(0));
    expect(await screen.findByText(/requests will appear here/i)).toBeInTheDocument();
  });

  it("downloads the current stored history as JSON", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.fn(() => "blob:history");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    await addEntry(spec("https://a.test/export"), ok, 1_000);
    render(<HistoryPanel />);

    await user.click(await screen.findByRole("button", { name: /export history/i }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:history");
  });

  it("uses ArrowUp from the URL field to recall history through the command registry", async () => {
    await addEntry(spec("https://a.test/older", "GET"), ok, 1_000);
    await addEntry(spec("https://a.test/newer", "DELETE"), ok, 2_000);
    useRequestStore.getState().setUrl("https://a.test/current");
    render(
      <KeyboardProvider>
        <RequestBar pending={false} onSubmit={() => {}} />
        <HistoryPanel />
      </KeyboardProvider>,
    );
    const input = screen.getByRole("textbox", { name: "Request URL" });
    await screen.findAllByTestId("history-row");

    input.focus();
    fireEvent.keyDown(input, { key: "ArrowUp" });

    await waitFor(() =>
      expect(useRequestStore.getState().spec).toMatchObject({
        method: "DELETE",
        url: "https://a.test/newer",
      }),
    );
    await waitFor(() => expect(input).toHaveValue("https://a.test/newer"));
  });

  it("surfaces IndexedDB open failures without crashing the panel", async () => {
    db.close();
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("IndexedDB blocked", "SecurityError");
    });

    render(<HistoryPanel />);

    expect(await screen.findByText(/history storage is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/requests can still be sent/i)).toBeInTheDocument();
  });

  it("keeps a write-unavailable notice after a later successful search read", async () => {
    const user = userEvent.setup();
    db.close();
    const open = vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("IndexedDB blocked", "SecurityError");
    });

    await expect(logSend(spec("https://a.test/write"), ok, ok.timeMs)).resolves.toBeNull();
    expect(getHistoryStorageStatus().writeUnavailable).toBe(true);

    open.mockRestore();
    db.close();
    await db.open();
    render(<HistoryPanel />);

    const search = await screen.findByRole("searchbox");
    await user.type(search, "still readable");
    expect(await screen.findByText(/history storage is unavailable/i)).toBeInTheDocument();
    expect(getHistoryStorageStatus()).toEqual({
      readUnavailable: false,
      writeUnavailable: true,
    });
  });
});
