export interface HistoryStorageStatus {
  readUnavailable: boolean;
  writeUnavailable: boolean;
}

let status: HistoryStorageStatus = {
  readUnavailable: false,
  writeUnavailable: false,
};
const listeners = new Set<() => void>();

export function getHistoryStorageStatus(): HistoryStorageStatus {
  return status;
}

export function subscribeToHistoryStorage(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateHistoryStorageStatus(
  next: Partial<HistoryStorageStatus>,
): void {
  const updated = { ...status, ...next };
  if (
    updated.readUnavailable === status.readUnavailable &&
    updated.writeUnavailable === status.writeUnavailable
  ) {
    return;
  }

  status = updated;
  for (const listener of listeners) listener();
}

export function setHistoryStorageReadUnavailable(value: boolean): void {
  updateHistoryStorageStatus({ readUnavailable: value });
}

export function setHistoryStorageWriteUnavailable(value: boolean): void {
  updateHistoryStorageStatus({ writeUnavailable: value });
}

export function resetHistoryStorageStatus(): void {
  updateHistoryStorageStatus({
    readUnavailable: false,
    writeUnavailable: false,
  });
}
