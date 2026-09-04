"use client";

import {
  ChevronDown,
  Folder,
  FolderPlus,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Collection, SavedRequest } from "@/lib/db/db";
import { methodColorClass } from "@/lib/http/method-color";
import type { SavedGroup } from "@/lib/saved/saved-store";
import { cn } from "@/lib/utils";

interface SavedSidebarProps {
  groups: SavedGroup[];
  onOpen(request: SavedRequest): void;
  onRenameSaved(id: string, name: string): void;
  onMoveSaved(id: string, collectionId: string | null): void;
  onDeleteSaved(id: string): void;
  onRenameCollection(id: string, name: string): void;
  onDeleteCollection(id: string, mode: "reassign" | "cascade"): void;
  onNewCollection(): void;
}

type RenameTarget =
  | { kind: "saved"; id: string; name: string }
  | { kind: "collection"; id: string; name: string };

function RequestRow({
  request,
  collections,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: {
  request: SavedRequest;
  collections: Collection[];
  onOpen(request: SavedRequest): void;
  onRename(): void;
  onMove(collectionId: string | null): void;
  onDelete(): void;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-lg border bg-background/50 p-1">
      <Button
        aria-label={`Open ${request.spec.method} ${request.name} ${request.spec.url}`}
        className="h-auto min-w-0 justify-start gap-3 px-2 py-2 text-left"
        onClick={() => onOpen(request)}
        type="button"
        variant="ghost"
      >
        <span
          className={cn(
            "shrink-0 font-mono text-xs font-semibold",
            methodColorClass(request.spec.method),
          )}
        >
          {request.spec.method}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {request.name}
          </span>
          <span
            className="block truncate font-mono text-xs text-muted-foreground"
            title={request.spec.url}
          >
            {request.spec.url}
          </span>
        </span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for saved request ${request.name}`}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onMove(null)}>
                Ungrouped
              </DropdownMenuItem>
              {collections.map((collection) => (
                <DropdownMenuItem
                  key={collection.id}
                  onClick={() => onMove(collection.id)}
                >
                  {collection.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function SavedSidebar({
  groups,
  onOpen,
  onRenameSaved,
  onMoveSaved,
  onDeleteSaved,
  onRenameCollection,
  onDeleteCollection,
  onNewCollection,
}: SavedSidebarProps) {
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const collections = groups.flatMap(({ collection }) =>
    collection ? [collection] : [],
  );
  const totalRequests = groups.reduce(
    (total, { requests }) => total + requests.length,
    0,
  );
  const ungrouped = groups.find(({ collection }) => collection === null);

  function beginRename(target: RenameTarget) {
    setRenameTarget(target);
    setRenameValue(target.name);
  }

  function commitRename() {
    const name = renameValue.trim();
    if (!renameTarget || !name) return;
    if (renameTarget.kind === "saved") {
      onRenameSaved(renameTarget.id, name);
    } else {
      onRenameCollection(renameTarget.id, name);
    }
    setRenameTarget(null);
  }

  return (
    <section
      aria-labelledby="saved-heading"
      className="rounded-xl border bg-card/90 p-4 shadow-sm backdrop-blur sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold" id="saved-heading">
            Saved requests
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Explicit browser-local snapshots, including request details.
          </p>
        </div>
        <Button onClick={onNewCollection} size="sm" type="button" variant="outline">
          <FolderPlus aria-hidden />
          New collection
        </Button>
      </div>

      {totalRequests === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-5 text-center">
          <p className="text-sm font-medium">
            No saved requests yet — save the current one to start a collection.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saving is explicit; automatic history keeps only method and URL.
          </p>
        </div>
      ) : null}

      {ungrouped?.requests.length ? (
        <div className="mt-4 space-y-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Ungrouped
          </h3>
          <ul className="space-y-1">
            {ungrouped.requests.map((request) => (
              <RequestRow
                collections={collections}
                key={request.id}
                onDelete={() => onDeleteSaved(request.id)}
                onMove={(collectionId) => onMoveSaved(request.id, collectionId)}
                onOpen={onOpen}
                onRename={() =>
                  beginRename({
                    kind: "saved",
                    id: request.id,
                    name: request.name,
                  })
                }
                request={request}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {groups
        .filter(
          (group): group is SavedGroup & { collection: Collection } =>
            group.collection !== null,
        )
        .map(({ collection, requests }) => (
          <Collapsible className="mt-4" defaultOpen key={collection.id}>
            <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
              <CollapsibleTrigger
                aria-label={`${collection.name} collection, ${requests.length} requests`}
                className="group flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronDown
                  aria-hidden
                  className="size-4 transition-transform group-data-[panel-open=false]:-rotate-90"
                />
                <Folder aria-hidden className="size-4 text-muted-foreground" />
                <span className="truncate">{collection.name}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {requests.length}
                </span>
              </CollapsibleTrigger>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={`Actions for collection ${collection.name}`}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  <MoreHorizontal aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      beginRename({
                        kind: "collection",
                        id: collection.id,
                        name: collection.name,
                      })
                    }
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteTarget(collection)}
                    variant="destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CollapsibleContent>
              {requests.length ? (
                <ul className="mt-1 space-y-1 pl-3">
                  {requests.map((request) => (
                    <RequestRow
                      collections={collections}
                      key={request.id}
                      onDelete={() => onDeleteSaved(request.id)}
                      onMove={(collectionId) =>
                        onMoveSaved(request.id, collectionId)
                      }
                      onOpen={onOpen}
                      onRename={() =>
                        beginRename({
                          kind: "saved",
                          id: request.id,
                          name: request.name,
                        })
                      }
                      request={request}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-3 pt-2 text-xs text-muted-foreground">
                  Empty collection
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rename {renameTarget?.kind === "collection" ? "collection" : "request"}
            </DialogTitle>
            <DialogDescription>
              Names must contain at least one non-space character.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-saved-item">Name</Label>
            <Input
              autoFocus
              id="rename-saved-item"
              onChange={(event) => setRenameValue(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && renameValue.trim()) {
                  event.preventDefault();
                  commitRename();
                }
              }}
              value={renameValue}
            />
            {!renameValue.trim() ? (
              <p className="text-xs text-destructive" role="alert">
                Enter a name.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setRenameTarget(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim()}
              onClick={commitRename}
              type="button"
            >
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Move its requests to Ungrouped by default, or explicitly delete the
              collection and every request inside it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  onDeleteCollection(deleteTarget.id, "cascade");
                  setDeleteTarget(null);
                }
              }}
              variant="destructive"
            >
              Delete collection and requests
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  onDeleteCollection(deleteTarget.id, "reassign");
                  setDeleteTarget(null);
                }
              }}
            >
              Move to Ungrouped
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
