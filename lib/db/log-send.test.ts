import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestSpec, SendResult } from "@/lib/http/types";

import { db } from "./db";
import { listHistory } from "./history";
import { logSend } from "./log-send";
import {
  getHistoryStorageStatus,
  resetHistoryStorageStatus,
} from "./storage-status";

const spec: RequestSpec = {
  method: "GET",
  url: "https://a.test/x",
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
};

const ok: SendResult = {
  ok: true,
  via: "direct",
  status: 200,
  statusText: "OK",
  timeMs: 5,
  sizeBytes: 3,
  body: { encoding: "utf8", text: "abc" },
  isJson: false,
  headers: [],
};

beforeEach(async () => {
  await db.history.clear();
  resetHistoryStorageStatus();
});

describe("logSend", () => {
  it("logs a resolved send as exactly one history entry", async () => {
    await logSend(spec, ok, ok.timeMs);

    expect(await listHistory()).toHaveLength(1);
    expect(getHistoryStorageStatus().writeUnavailable).toBe(false);
  });

  it("logs resolved failures", async () => {
    await logSend(
      spec,
      {
        ok: false,
        kind: "network",
        message: "No response",
      },
      123,
    );

    const [entry] = await listHistory();
    expect(entry.result.status).toBeNull();
    expect(entry.result.error).toEqual({
      kind: "network",
      message: "No response",
    });
    expect(entry.result.timeMs).toBe(123);
  });

  it("never throws and marks writes unavailable when IndexedDB cannot open", async () => {
    db.close();
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("IndexedDB blocked", "SecurityError");
    });

    await expect(logSend(spec, ok, ok.timeMs)).resolves.toBeUndefined();
    expect(getHistoryStorageStatus().writeUnavailable).toBe(true);
  });
});
