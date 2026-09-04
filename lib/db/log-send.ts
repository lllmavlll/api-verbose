import type { RequestSpec, SendResult } from "@/lib/http/types";

import type { HistoryEntry } from "./db";
import { addEntry } from "./history";
import { setHistoryStorageWriteUnavailable } from "./storage-status";

export async function logSend(
  spec: RequestSpec,
  result: SendResult,
  measuredTimeMs: number,
): Promise<HistoryEntry | null> {
  try {
    const entry = await addEntry(spec, result, Date.now(), measuredTimeMs);
    setHistoryStorageWriteUnavailable(false);
    return entry;
  } catch {
    setHistoryStorageWriteUnavailable(true);
    return null;
  }
}
