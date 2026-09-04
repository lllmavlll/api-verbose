import { db, type Collection, type SavedRequest } from "@/lib/db/db";
import type { RequestSpec } from "@/lib/http/types";

export type SavedFailure = {
  ok: false;
  error: "invalid-name" | "persist-failed";
  message: string;
};

export type SavedOk<T> = { ok: true; value: T };
export type SavedResult<T> = SavedOk<T> | SavedFailure;

export interface SavedGroup {
  collection: Collection | null;
  requests: SavedRequest[];
}

const invalidName = (): SavedFailure => ({
  ok: false,
  error: "invalid-name",
  message: "Enter a name before saving.",
});

const persistFailed = (): SavedFailure => ({
  ok: false,
  error: "persist-failed",
  message: "Saved-request storage is unavailable in this browser.",
});

function normalizedName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed ? trimmed : null;
}

function byNameThenId<T extends { id: string; name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

export async function saveRequest(input: {
  name: string;
  collectionId: string | null;
  spec: RequestSpec;
}): Promise<SavedResult<SavedRequest>> {
  const name = normalizedName(input.name);
  if (!name) return invalidName();

  const saved: SavedRequest = {
    id: crypto.randomUUID(),
    name,
    collectionId: input.collectionId,
    spec: input.spec,
  };

  try {
    await db.savedRequests.put(saved);
    return { ok: true, value: saved };
  } catch {
    return persistFailed();
  }
}

export async function createCollection(
  value: string,
): Promise<SavedResult<Collection>> {
  const name = normalizedName(value);
  if (!name) return invalidName();

  const collection: Collection = { id: crypto.randomUUID(), name };
  try {
    await db.collections.put(collection);
    return { ok: true, value: collection };
  } catch {
    return persistFailed();
  }
}

export async function listCollections(): Promise<Collection[]> {
  return (await db.collections.toArray()).sort(byNameThenId);
}

export async function listSavedRequests(): Promise<SavedRequest[]> {
  return (await db.savedRequests.toArray()).sort(byNameThenId);
}

export async function renameSaved(
  id: string,
  value: string,
): Promise<SavedResult<SavedRequest>> {
  const name = normalizedName(value);
  if (!name) return invalidName();

  try {
    if ((await db.savedRequests.update(id, { name })) === 0) {
      return persistFailed();
    }
    const saved = await db.savedRequests.get(id);
    return saved ? { ok: true, value: saved } : persistFailed();
  } catch {
    return persistFailed();
  }
}

export async function renameCollection(
  id: string,
  value: string,
): Promise<SavedResult<Collection>> {
  const name = normalizedName(value);
  if (!name) return invalidName();

  try {
    if ((await db.collections.update(id, { name })) === 0) {
      return persistFailed();
    }
    const collection = await db.collections.get(id);
    return collection ? { ok: true, value: collection } : persistFailed();
  } catch {
    return persistFailed();
  }
}

export async function moveSaved(
  id: string,
  collectionId: string | null,
): Promise<SavedResult<SavedRequest>> {
  try {
    if ((await db.savedRequests.update(id, { collectionId })) === 0) {
      return persistFailed();
    }
    const saved = await db.savedRequests.get(id);
    return saved ? { ok: true, value: saved } : persistFailed();
  } catch {
    return persistFailed();
  }
}

export async function deleteSaved(id: string): Promise<SavedResult<void>> {
  try {
    await db.savedRequests.delete(id);
    return { ok: true, value: undefined };
  } catch {
    return persistFailed();
  }
}

export async function deleteCollection(
  id: string,
  mode: "reassign" | "cascade",
): Promise<SavedResult<void>> {
  try {
    await db.transaction("rw", db.collections, db.savedRequests, async () => {
      const requests = db.savedRequests.where("collectionId").equals(id);
      if (mode === "cascade") {
        await requests.delete();
      } else {
        await requests.modify({ collectionId: null });
      }
      await db.collections.delete(id);
    });
    return { ok: true, value: undefined };
  } catch {
    return persistFailed();
  }
}

export function groupByCollection(
  collections: Collection[],
  saved: SavedRequest[],
): SavedGroup[] {
  return [
    {
      collection: null,
      requests: saved.filter(({ collectionId }) => collectionId === null),
    },
    ...collections.map((collection) => ({
      collection,
      requests: saved.filter(
        ({ collectionId }) => collectionId === collection.id,
      ),
    })),
  ];
}
