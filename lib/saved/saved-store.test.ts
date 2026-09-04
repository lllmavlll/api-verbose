import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db/db";
import type { RequestSpec } from "@/lib/http/types";

import {
  createCollection,
  deleteCollection,
  deleteSaved,
  groupByCollection,
  listCollections,
  listSavedRequests,
  moveSaved,
  renameCollection,
  renameSaved,
  saveRequest,
} from "./saved-store";

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

afterEach(() => vi.restoreAllMocks());

describe("saved request store", () => {
  it("saves a row with a generated id", async () => {
    const result = await saveRequest({
      name: "zen",
      collectionId: null,
      spec,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toEqual(expect.any(String));
      expect(await db.savedRequests.get(result.value.id)).toEqual(result.value);
    }
  });

  it("sorts collections and requests by name then id", async () => {
    await db.collections.bulkPut([
      { id: "c2", name: "Beta" },
      { id: "c1", name: "Alpha" },
    ]);
    await db.savedRequests.bulkPut([
      { id: "s2", name: "same", collectionId: null, spec },
      { id: "s1", name: "same", collectionId: null, spec },
      { id: "s0", name: "first", collectionId: null, spec },
    ]);

    expect((await listCollections()).map(({ id }) => id)).toEqual(["c1", "c2"]);
    expect((await listSavedRequests()).map(({ id }) => id)).toEqual([
      "s0",
      "s1",
      "s2",
    ]);
  });

  it("groups Ungrouped first and retains empty collections", async () => {
    const collection = await createCollection("GitHub");
    const collectionId = collection.ok ? collection.value.id : "";
    await saveRequest({ name: "top", collectionId: null, spec });
    await saveRequest({ name: "in-col", collectionId, spec });
    await createCollection("Empty");

    const groups = groupByCollection(
      await listCollections(),
      await listSavedRequests(),
    );

    expect(groups[0].collection).toBeNull();
    expect(groups[0].requests.map(({ name }) => name)).toEqual(["top"]);
    expect(groups.find(({ collection: c }) => c?.name === "GitHub")?.requests)
      .toHaveLength(1);
    expect(groups.find(({ collection: c }) => c?.name === "Empty")?.requests)
      .toEqual([]);
  });

  it("rejects empty names without mutating existing rows", async () => {
    const saved = await saveRequest({ name: "keep", collectionId: null, spec });
    const collection = await createCollection("Also keep");
    const savedId = saved.ok ? saved.value.id : "";
    const collectionId = collection.ok ? collection.value.id : "";

    expect(await renameSaved(savedId, "   ")).toMatchObject({
      ok: false,
      error: "invalid-name",
    });
    expect(await renameCollection(collectionId, "")).toMatchObject({
      ok: false,
      error: "invalid-name",
    });
    expect((await db.savedRequests.get(savedId))?.name).toBe("keep");
    expect((await db.collections.get(collectionId))?.name).toBe("Also keep");
  });

  it("renames valid rows and trims their names", async () => {
    const saved = await saveRequest({ name: "before", collectionId: null, spec });
    const collection = await createCollection("before");
    const savedId = saved.ok ? saved.value.id : "";
    const collectionId = collection.ok ? collection.value.id : "";

    expect(await renameSaved(savedId, " after ")).toMatchObject({
      ok: true,
      value: { name: "after" },
    });
    expect(await renameCollection(collectionId, " after ")).toMatchObject({
      ok: true,
      value: { name: "after" },
    });
  });

  it("moves a saved request between collections", async () => {
    const collection = await createCollection("C");
    const collectionId = collection.ok ? collection.value.id : "";
    const saved = await saveRequest({ name: "move", collectionId: null, spec });
    const savedId = saved.ok ? saved.value.id : "";

    expect(await moveSaved(savedId, collectionId)).toMatchObject({
      ok: true,
      value: { collectionId },
    });
    expect((await db.savedRequests.get(savedId))?.collectionId).toBe(collectionId);
  });

  it("reassigns collection requests to Ungrouped by default", async () => {
    const collection = await createCollection("C");
    const collectionId = collection.ok ? collection.value.id : "";
    const saved = await saveRequest({ name: "orphan", collectionId, spec });
    const savedId = saved.ok ? saved.value.id : "";

    expect((await deleteCollection(collectionId, "reassign")).ok).toBe(true);
    expect(await db.collections.get(collectionId)).toBeUndefined();
    expect((await db.savedRequests.get(savedId))?.collectionId).toBeNull();
  });

  it("cascade-deletes collection requests only when explicit", async () => {
    const collection = await createCollection("C");
    const collectionId = collection.ok ? collection.value.id : "";
    const saved = await saveRequest({ name: "gone", collectionId, spec });
    const savedId = saved.ok ? saved.value.id : "";

    expect((await deleteCollection(collectionId, "cascade")).ok).toBe(true);
    expect(await db.savedRequests.get(savedId)).toBeUndefined();
  });

  it("deletes a saved row", async () => {
    const saved = await saveRequest({ name: "delete", collectionId: null, spec });
    const savedId = saved.ok ? saved.value.id : "";

    expect((await deleteSaved(savedId)).ok).toBe(true);
    expect(await db.savedRequests.get(savedId)).toBeUndefined();
  });

  it("surfaces rejected writes as typed failures", async () => {
    vi.spyOn(db.savedRequests, "put").mockRejectedValueOnce(
      new Error("QuotaExceededError"),
    );

    await expect(
      saveRequest({ name: "q", collectionId: null, spec }),
    ).resolves.toMatchObject({ ok: false, error: "persist-failed" });
  });
});
