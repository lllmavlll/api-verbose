import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db, type HistoryEntry } from "./db";

beforeEach(async () => {
  await db.history.clear();
});

describe("ApiVerboseDb", () => {
  it("opens at version 3 with history, saved-request, collection, and assertion stores", async () => {
    await db.open();

    expect(db.verno).toBe(3);
    expect(db.history.schema.primKey.name).toBe("id");
    expect(db.history.schema.indexes.map((index) => index.name)).toContain("at");
    expect(db.savedRequests.schema.primKey.name).toBe("id");
    expect(db.collections.schema.primKey.name).toBe("id");
    expect(db.assertions.schema.primKey.name).toBe("id");
    expect(db.assertions.schema.indexes.map((index) => index.name)).toContain(
      "requestRef",
    );
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
