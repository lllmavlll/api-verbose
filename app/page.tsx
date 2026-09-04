"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { CopyAsCodeMenu } from "@/components/copy-as-code-menu";
import { HistoryPanel } from "@/components/history-panel";
import { ImportCurlDialog } from "@/components/import-curl-dialog";
import { KeyboardProvider } from "@/components/keyboard-provider";
import { RequestBar } from "@/components/request-bar";
import { RequestBody } from "@/components/request-body";
import { RequestTabs } from "@/components/request-tabs";
import { ResponsePanel } from "@/components/response-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { SavedSidebar } from "@/components/saved-sidebar";
import { SaveRequestDialog } from "@/components/save-request-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCoreCommands } from "@/components/use-core-commands";
import type { SavedRequest } from "@/lib/db/db";
import { logSend } from "@/lib/db/log-send";
import { sendRequest } from "@/lib/http/send-request";
import { useHydrated } from "@/hooks/use-hydrated";
import type { SendResult } from "@/lib/http/types";
import { composeRequest } from "@/lib/request/compose";
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
  type SavedGroup,
  type SavedResult,
} from "@/lib/saved/saved-store";
import {
  fromSavedSnapshot,
  suggestName,
  toSavedSnapshot,
} from "@/lib/saved/snapshot";
import { useRequestStore } from "@/lib/store/request-store";

const emptySavedGroups: SavedGroup[] = [{ collection: null, requests: [] }];

export default function Home() {
  const hydrated = useHydrated();
  const setMethod = useRequestStore((state) => state.setMethod);
  const [pending, setPending] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<SendResult | null>(null);
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>(emptySavedGroups);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const pendingRef = useRef(false);
  const startedAtRef = useRef(0);

  const refreshSaved = useCallback(async () => {
    try {
      const [collections, saved] = await Promise.all([
        listCollections(),
        listSavedRequests(),
      ]);
      setSavedGroups(groupByCollection(collections, saved));
      setSavedError(null);
    } catch {
      setSavedError("Saved-request storage is unavailable in this browser.");
    }
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    if (!pending) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAtRef.current);
    }, 50);

    return () => window.clearInterval(timer);
  }, [pending]);

  async function handleSubmit() {
    if (pendingRef.current) {
      return;
    }

    const builderSpec = useRequestStore.getState().spec;
    const wireSpec = composeRequest(builderSpec);

    pendingRef.current = true;
    startedAtRef.current = performance.now();
    setElapsedMs(0);
    setResult(null);
    setPending(true);

    try {
      const nextResult = await sendRequest(wireSpec);
      const measuredTimeMs = performance.now() - startedAtRef.current;
      setResult(nextResult);
      void logSend(builderSpec, nextResult, measuredTimeMs);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function applySavedMutation(result: Promise<SavedResult<unknown>>) {
    const next = await result;
    if (!next.ok) {
      setSavedError(next.message);
      return false;
    }
    setSavedError(null);
    await refreshSaved();
    return true;
  }

  async function handleCreateCollection(name: string) {
    return applySavedMutation(createCollection(name));
  }

  async function handleSave(input: {
    name: string;
    collectionId: string | null;
  }) {
    const spec = useRequestStore.getState().spec;
    const saved = await applySavedMutation(
      saveRequest({ ...input, spec: toSavedSnapshot(spec) }),
    );
    if (saved) setSaveOpen(false);
  }

  function handleOpenSaved(request: SavedRequest) {
    useRequestStore.getState().loadSpec(fromSavedSnapshot(request.spec));
  }

  useCoreCommands({
    isSending: pending,
    onSend: () => {
      const form = document.querySelector<HTMLFormElement>("#request-form");
      form?.requestSubmit();
    },
    onFocusUrl: () => {
      document.querySelector<HTMLInputElement>("#request-url")?.focus();
    },
    setMethod,
  });

  return (
    <KeyboardProvider>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,var(--color-muted),transparent_42%)] px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 font-mono text-xs tracking-[0.22em] text-muted-foreground uppercase">
                Local-first REST client
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Verbose
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Send an HTTP request and read the response without an account or
                cloud sync.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {pending ? (
                <p
                  aria-live="polite"
                  className="font-mono text-sm text-muted-foreground"
                >
                  Sending · {Math.round(elapsedMs)} ms
                </p>
              ) : null}
              <ThemeToggle />
            </div>
          </header>

          {savedError ? (
            <Alert className="mb-5" role="status" variant="destructive">
              <AlertTitle>Saved requests are unavailable.</AlertTitle>
              <AlertDescription>
                {savedError} The request currently in the workbench is unchanged.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]">
            <SavedSidebar
              groups={savedGroups}
              onDeleteCollection={(id, mode) => {
                void applySavedMutation(deleteCollection(id, mode));
              }}
              onDeleteSaved={(id) => {
                void applySavedMutation(deleteSaved(id));
              }}
              onMoveSaved={(id, collectionId) => {
                void applySavedMutation(moveSaved(id, collectionId));
              }}
              onNewCollection={() => {
                setNewCollectionName("");
                setNewCollectionOpen(true);
              }}
              onOpen={handleOpenSaved}
              onRenameCollection={(id, name) => {
                void applySavedMutation(renameCollection(id, name));
              }}
              onRenameSaved={(id, name) => {
                void applySavedMutation(renameSaved(id, name));
              }}
            />

            <div className="min-w-0">
              <section
                aria-busy={!hydrated}
                className="mb-5 rounded-xl border bg-card/90 p-4 shadow-sm backdrop-blur sm:p-5"
              >
                <fieldset
                  className="min-w-0 border-0 p-0"
                  disabled={!hydrated}
                >
                  <RequestBar pending={pending} onSubmit={handleSubmit} />
                  <div
                    aria-label="Request import, export, and save"
                    className="mt-3 flex flex-col items-start gap-2 sm:flex-row"
                    role="group"
                  >
                    <ImportCurlDialog />
                    <CopyAsCodeMenu />
                    <Button
                      onClick={() => setSaveOpen(true)}
                      type="button"
                      variant="outline"
                    >
                      Save request
                    </Button>
                  </div>
                  <div className="mt-4 border-t pt-4">
                    <RequestBody />
                  </div>
                  <div className="mt-4 border-t pt-4">
                    <RequestTabs />
                  </div>
                </fieldset>
              </section>

              <ResponsePanel pending={pending} result={result} />
              <HistoryPanel />
            </div>
          </div>

          <SaveRequestDialog
            collections={savedGroups.flatMap(({ collection }) =>
              collection ? [collection] : [],
            )}
            defaultName={suggestName(useRequestStore.getState().spec)}
            onCreateCollection={(name) => {
              void handleCreateCollection(name);
            }}
            onOpenChange={setSaveOpen}
            onSave={(input) => {
              void handleSave(input);
            }}
            open={saveOpen}
          />

          <Dialog open={newCollectionOpen} onOpenChange={setNewCollectionOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New collection</DialogTitle>
                <DialogDescription>
                  Create an empty browser-local folder for saved requests.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="new-collection-name">Collection name</Label>
                <Input
                  autoFocus
                  id="new-collection-name"
                  onChange={(event) =>
                    setNewCollectionName(event.currentTarget.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && newCollectionName.trim()) {
                      event.preventDefault();
                      void handleCreateCollection(newCollectionName).then(
                        (created) => {
                          if (created) setNewCollectionOpen(false);
                        },
                      );
                    }
                  }}
                  value={newCollectionName}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => setNewCollectionOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!newCollectionName.trim()}
                  onClick={() => {
                    void handleCreateCollection(newCollectionName).then(
                      (created) => {
                        if (created) setNewCollectionOpen(false);
                      },
                    );
                  }}
                  type="button"
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </KeyboardProvider>
  );
}
