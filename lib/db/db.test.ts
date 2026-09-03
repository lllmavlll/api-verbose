import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db, type HistoryEntry } from "./db";

beforeEach(async () => {
  await db.history.clear();
});

describe("ApiVerboseDb", () => {
  it("opens at version 1 with history keyed by id and indexed on at", async () => {
    await db.open();

    expect(db.verno).toBe(1);
    expect(db.history.schema.primKey.name).toBe("id");
    expect(db.history.schema.indexes.map((index) => index.name)).toContain("at");
  });

  it("round-trips a replay-safe history entry", async () => {
    const entry: HistoryEntry = {
      id: "entry-1",
      at: 1_000,
      spec: { method: "GET", url: "https://api.test/x" },
      result: {
        ok: true,
        status: 200,
        statusText: "OK",
        timeMs: 12,
        sizeBytes: 7,
        isJson: true,
        via: "direct",
      },
    };

    await db.history.put(entry);

    expect(await db.history.get("entry-1")).toEqual(entry);
  });
});
