"use client";

import { useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Collection } from "@/lib/db/db";

const UNGROUPED = "__ungrouped__";
const NEW_COLLECTION = "__new_collection__";

interface SaveRequestDialogProps {
  open: boolean;
  defaultName: string;
  collections: Collection[];
  onSave(input: { name: string; collectionId: string | null }): void;
  onCreateCollection(name: string): void;
  onOpenChange(open: boolean): void;
}

function SaveRequestDialogContent({
  defaultName,
  collections,
  onSave,
  onCreateCollection,
  onOpenChange,
}: Omit<SaveRequestDialogProps, "open">) {
  const [name, setName] = useState(defaultName);
  const [collectionId, setCollectionId] = useState(UNGROUPED);
  const [newCollectionName, setNewCollectionName] = useState("");

  const collectionLabel =
    collectionId === UNGROUPED
      ? "Ungrouped"
      : collectionId === NEW_COLLECTION
        ? "New collection…"
        : (collections.find(({ id }) => id === collectionId)?.name ??
          "Ungrouped");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Save request</DialogTitle>
        <DialogDescription>
          Save this complete request definition to this browser.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="saved-request-name">Request name</Label>
            <Input
              autoFocus
              id="saved-request-name"
              onChange={(event) => setName(event.currentTarget.value)}
              value={name}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="saved-request-collection">Collection</Label>
            <Select
              onValueChange={(value) => {
                if (value) setCollectionId(value);
              }}
              value={collectionId}
            >
              <SelectTrigger
                aria-label="Collection"
                className="w-full"
                id="saved-request-collection"
              >
                <SelectValue>{collectionLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value={UNGROUPED}>Ungrouped</SelectItem>
                {collections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_COLLECTION}>New collection…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {collectionId === NEW_COLLECTION ? (
            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="new-saved-collection">New collection name</Label>
              <div className="flex gap-2">
                <Input
                  id="new-saved-collection"
                  onChange={(event) =>
                    setNewCollectionName(event.currentTarget.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && newCollectionName.trim()) {
                      event.preventDefault();
                      onCreateCollection(newCollectionName.trim());
                      setNewCollectionName("");
                      setCollectionId(UNGROUPED);
                    }
                  }}
                  value={newCollectionName}
                />
                <Button
                  disabled={!newCollectionName.trim()}
                  onClick={() => {
                    onCreateCollection(newCollectionName.trim());
                    setNewCollectionName("");
                    setCollectionId(UNGROUPED);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Create
                </Button>
              </div>
            </div>
          ) : null}
      </div>

      <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || collectionId === NEW_COLLECTION}
            onClick={() =>
              onSave({
                name: name.trim(),
                collectionId:
                  collectionId === UNGROUPED ? null : collectionId,
              })
            }
            type="button"
          >
            Save
          </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function SaveRequestDialog({
  open,
  defaultName,
  collections,
  onSave,
  onCreateCollection,
  onOpenChange,
}: SaveRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <SaveRequestDialogContent
          collections={collections}
          defaultName={defaultName}
          onCreateCollection={onCreateCollection}
          onOpenChange={onOpenChange}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  );
}
