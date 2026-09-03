import type { RequestSpec, SendResult } from "@/lib/http/types";

import {
  db,
  type HistoryEntry,
  type HistoryRequestSnapshot,
  type SendResultSummary,
} from "./db";

export const HISTORY_CAP = 500;

export function toSummary(
  result: SendResult,
  measuredTimeMs?: number,
): SendResultSummary {
  if (!result.ok) {
    if (
      measuredTimeMs === undefined ||
      !Number.isFinite(measuredTimeMs) ||
      measuredTimeMs < 0
    ) {
      throw new TypeError("A measured elapsed time is required for failed sends.");
    }

    return {
      ok: false,
      status: null,
      statusText: "",
      timeMs: measuredTimeMs,
      isJson: false,
      error: { kind: result.kind, message: result.message },
    };
  }

  return {
    ok: true,
    status: result.status,
    statusText: result.statusText,
    timeMs: result.timeMs,
    sizeBytes: result.sizeBytes,
    isJson: result.isJson,
    via: result.via,
  };
}

function toSnapshot(spec: RequestSpec): HistoryRequestSnapshot {
  return { method: spec.method, url: spec.url };
}

export async function addEntry(
  spec: RequestSpec,
  result: SendResult,
  at = Date.now(),
  measuredTimeMs?: number,
): Promise<HistoryEntry> {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    at,
    spec: toSnapshot(spec),
    result: toSummary(result, measuredTimeMs),
  };

  await db.transaction("rw", db.history, async () => {
    await db.history.put(entry);

    const overflow = (await db.history.count()) - HISTORY_CAP;
    if (overflow > 0) {
      const oldestIds = await db.history
        .orderBy("at")
        .limit(overflow)
        .primaryKeys();
      await db.history.bulkDelete(oldestIds);
    }
  });

  return entry;
}

export async function listHistory(
  options: { search?: string } = {},
): Promise<HistoryEntry[]> {
  const entries = await db.history.orderBy("at").reverse().toArray();
  const search = options.search?.trim().toLocaleLowerCase() ?? "";
  if (!search) return entries;

  return entries.filter((entry) =>
    `${entry.spec.method} ${entry.spec.url}`.toLocaleLowerCase().includes(search),
  );
}

export async function clearHistory(): Promise<void> {
  await db.history.clear();
}

export async function exportHistoryJson(): Promise<string> {
  return JSON.stringify(await listHistory(), null, 2);
}
