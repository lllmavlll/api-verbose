import type { RequestSpec, SendResult } from "@/lib/http/types";

import { addEntry } from "./history";
import { setHistoryStorageWriteUnavailable } from "./storage-status";

export async function logSend(
  spec: RequestSpec,
  result: SendResult,
  measuredTimeMs: number,
): Promise<void> {
  try {
    await addEntry(spec, result, Date.now(), measuredTimeMs);
    setHistoryStorageWriteUnavailable(false);
  } catch {
    setHistoryStorageWriteUnavailable(true);
  }
}
