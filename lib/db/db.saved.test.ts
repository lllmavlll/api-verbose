import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import type { RequestSpec } from "@/lib/http/types";

import { db, type Collection, type SavedRequest } from "./db";

const spec: RequestSpec = {
  method: "GET",
  url: "https://api.test/x",
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
};

beforeEach(async () => {
  await db.savedRequests.clear();
  await db.collections.clear();
});

describe("saved request tables", () => {
  it("exposes savedRequests and collections tables on the same db instance", () => {
    expect(db.savedRequests).toBeDefined();
    expect(db.collections).toBeDefined();
  });

  it("round-trips a SavedRequest row keyed by id", async () => {
    const row: SavedRequest = {
      id: "s1",
      name: "zen",
      collectionId: null,
      spec,
    };

    await db.savedRequests.put(row);

    expect(await db.savedRequests.get("s1")).toEqual(row);
  });

  it("round-trips a Collection and queries saved requests by collectionId", async () => {
    const collection: Collection = { id: "c1", name: "GitHub" };
    await db.collections.put(collection);
    await db.savedRequests.put({
      id: "s2",
      name: "repos",
      collectionId: "c1",
      spec,
    });

    expect(await db.collections.get("c1")).toEqual(collection);
    expect(
      await db.savedRequests.where("collectionId").equals("c1").count(),
    ).toBe(1);
  });
});
