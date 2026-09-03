"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Download, History, RotateCcw, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { registerCommand } from "@/lib/commands";
import type { HistoryEntry } from "@/lib/db/db";
import {
  clearHistory,
  exportHistoryJson,
  listHistory,
} from "@/lib/db/history";
import {
  getHistoryStorageStatus,
  setHistoryStorageReadUnavailable,
  setHistoryStorageWriteUnavailable,
  subscribeToHistoryStorage,
} from "@/lib/db/storage-status";
import { METHOD_COLOR_CLASS } from "@/lib/http/method-colors";
import { useRequestStore } from "@/lib/store/request-store";
import { cn } from "@/lib/utils";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const availableStorageStatus = {
  readUnavailable: false,
  writeUnavailable: false,
};

function formatRelativeTime(at: number): string {
  const seconds = Math.round((at - Date.now()) / 1_000);
  if (Math.abs(seconds) < 60) return relativeTime.format(seconds, "second");

  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");

  return relativeTime.format(Math.round(hours / 24), "day");
}

function isUrlInputEvent(event: KeyboardEvent): boolean {
  return (
    event.target instanceof HTMLElement &&
    Boolean(event.target.closest("[data-request-url]"))
  );
}

export function HistoryPanel() {
  const [search, setSearch] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const reset = useRequestStore((state) => state.reset);
  const setMethod = useRequestStore((state) => state.setMethod);
  const setUrl = useRequestStore((state) => state.setUrl);
  const entries = useLiveQuery(async () => {
    try {
      const rows = await listHistory({ search });
      setHistoryStorageReadUnavailable(false);
      return rows;
    } catch {
      setHistoryStorageReadUnavailable(true);
      return [];
    }
  }, [search]);
  const storageStatus = useSyncExternalStore(
    subscribeToHistoryStorage,
    getHistoryStorageStatus,
    () => availableStorageStatus,
  );
  const storageUnavailable =
    storageStatus.readUnavailable || storageStatus.writeUnavailable;
  const entriesRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const hasEntries = Boolean(entries?.length);

  useEffect(() => {
    entriesRef.current = entries ?? [];
    historyIndexRef.current = -1;
  }, [entries]);

  const replay = useCallback((entry: HistoryEntry) => {
    const urlInput = document.querySelector<HTMLInputElement>("#request-url");
    urlInput?.blur();
    reset();
    setMethod(entry.spec.method);
    setUrl(entry.spec.url);
    window.requestAnimationFrame(() => {
      urlInput?.focus();
    });
  }, [reset, setMethod, setUrl]);

  useEffect(() => {
    if (!hasEntries) return;

    const disposePrevious = registerCommand({
      id: "history-previous",
      title: "Previous request in history",
      keys: "arrowup",
      group: "History",
      when: isUrlInputEvent,
      run: () => {
        const rows = entriesRef.current;
        if (rows.length === 0) return;
        historyIndexRef.current = Math.min(
          historyIndexRef.current + 1,
          rows.length - 1,
        );
        replay(rows[historyIndexRef.current]);
      },
    });
    const disposeNext = registerCommand({
      id: "history-next",
      title: "Next request in history",
      keys: "arrowdown",
      group: "History",
      when: isUrlInputEvent,
      run: () => {
        const rows = entriesRef.current;
        if (rows.length === 0 || historyIndexRef.current <= 0) return;
        historyIndexRef.current -= 1;
        replay(rows[historyIndexRef.current]);
      },
    });

    return () => {
      disposePrevious();
      disposeNext();
    };
  }, [hasEntries, replay]);

  async function handleClear() {
    try {
      await clearHistory();
      setHistoryStorageReadUnavailable(false);
      setHistoryStorageWriteUnavailable(false);
      setClearOpen(false);
    } catch {
      setHistoryStorageWriteUnavailable(true);
    }
  }

  async function handleExport() {
    try {
      const json = await exportHistoryJson();
      const objectUrl = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "api-verbose-history.json";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setHistoryStorageReadUnavailable(false);
    } catch {
      setHistoryStorageReadUnavailable(true);
    }
  }

  return (
    <section
      aria-labelledby="history-heading"
      className="mt-5 rounded-xl border bg-card/90 p-4 shadow-sm backdrop-blur sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History aria-hidden className="size-4 text-muted-foreground" />
            <h2 className="font-semibold" id="history-heading">
              History
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Browser-local method and URL snapshots. Sensitive request details are never saved.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            aria-label="Export history as JSON"
            disabled={storageStatus.readUnavailable || !entries?.length}
            onClick={handleExport}
            size="sm"
            type="button"
            variant="outline"
          >
            <Download aria-hidden />
            Export
          </Button>
          <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
            <AlertDialogTrigger
              disabled={storageStatus.readUnavailable || !entries?.length}
              render={
                <Button size="sm" type="button" variant="destructive">
                  <Trash2 aria-hidden />
                  Clear
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes every browser-local history entry. The database remains ready for new requests.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear} variant="destructive">
                  Clear history
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Input
        aria-label="Search history by method or URL"
        className="mt-4 font-mono"
        disabled={storageStatus.readUnavailable}
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder="Search method or URL"
        type="search"
        value={search}
      />

      {storageUnavailable ? (
        <Alert className="mt-4" role="status" variant="destructive">
          <AlertTitle>History storage is unavailable.</AlertTitle>
          <AlertDescription>
            Requests can still be sent, but history will not persist in this browser.
          </AlertDescription>
        </Alert>
      ) : entries === undefined ? (
        <div className="mt-4 space-y-2" data-testid="history-loading">
          <Skeleton className="h-10" />
          <Skeleton className="h-10 opacity-70" />
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm font-medium">
            {search.trim() ? "No matching requests" : "Requests will appear here after sending."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search.trim()
              ? `Nothing matches “${search.trim()}”.`
              : "History survives reloads on this browser and stays on this device."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto" aria-label="Request history">
          {entries.map((entry) => (
            <li
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2"
              data-testid="history-row"
              key={entry.id}
            >
              <span
                className={cn(
                  "font-mono text-xs font-semibold",
                  METHOD_COLOR_CLASS[entry.spec.method],
                )}
              >
                {entry.spec.method}
              </span>
              <div className="min-w-0 font-mono text-xs">
                <p className="truncate text-foreground" title={entry.spec.url}>
                  {entry.spec.url}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground">
                  <span>{entry.result.status ?? "—"}</span>
                  <span>{Math.round(entry.result.timeMs)} ms</span>
                  <span>{formatRelativeTime(entry.at)}</span>
                </p>
              </div>
              <Button
                aria-label={`Replay ${entry.spec.method} ${entry.spec.url}`}
                onClick={() => replay(entry)}
                size="icon-sm"
                title="Replay method and URL"
                type="button"
                variant="ghost"
              >
                <RotateCcw aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
