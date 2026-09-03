"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { KV } from "@/lib/http/types";
import { cn } from "@/lib/utils";

type KvEditorTableProps = {
  label: string;
  rows: KV[];
  onChange: (rows: KV[]) => void;
  addDraftRow?: boolean;
  emptyMessage?: string;
  overriddenKeys?: string[];
  removeEmptyRowsOnBlur?: boolean;
};

function newDraft(): KV {
  return {
    id: crypto.randomUUID(),
    key: "",
    value: "",
    enabled: true,
  };
}

export function KvEditorTable({
  label,
  rows,
  onChange,
  addDraftRow = false,
  emptyMessage,
  overriddenKeys = [],
  removeEmptyRowsOnBlur = false,
}: KvEditorTableProps) {
  const [draft, setDraft] = useState<KV>(newDraft);
  const overridden = new Set(overriddenKeys.map((key) => key.toLowerCase()));
  const displayedRows = addDraftRow ? [...rows, draft] : rows;

  function updateRow(id: string, patch: Partial<KV>) {
    if (addDraftRow && id === draft.id) {
      onChange([...rows, { ...draft, ...patch }]);
      setDraft(newDraft());
      return;
    }

    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  function removeIfEmpty(id: string, field: "key" | "value", value: string) {
    if (!removeEmptyRowsOnBlur) {
      return;
    }

    const row = rows.find((candidate) => candidate.id === id);
    const current = row ? { ...row, [field]: value } : null;
    if (current && current.key === "" && current.value === "") {
      removeRow(id);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center">
            <span className="sr-only">Enabled</span>
          </TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {displayedRows.length === 0 && emptyMessage ? (
          <TableRow>
            <TableCell
              className="py-6 text-center text-sm text-muted-foreground"
              colSpan={4}
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          displayedRows.map((row, index) => {
            const isDraft = addDraftRow && row.id === draft.id;
            const isOverridden =
              !isDraft && overridden.has(row.key.toLowerCase());

            return (
              <TableRow
                className={cn(isOverridden && "bg-muted/60 text-muted-foreground")}
                key={row.id}
              >
                <TableCell className="text-center">
                  <Checkbox
                    aria-label={`Enable ${row.key || `${label} row ${index + 1}`}`}
                    checked={row.enabled}
                    onCheckedChange={(enabled) => updateRow(row.id, { enabled })}
                  />
                </TableCell>
                <TableCell className="min-w-40">
                  <Input
                    aria-label={`${label} key ${index + 1}`}
                    className="font-mono"
                    onBlur={(event) =>
                      removeIfEmpty(row.id, "key", event.currentTarget.value)
                    }
                    onChange={(event) =>
                      updateRow(row.id, { key: event.target.value })
                    }
                    placeholder="Key"
                    value={row.key}
                  />
                  {isOverridden ? (
                    <p className="mt-1 text-[11px]">overridden by Auth</p>
                  ) : null}
                </TableCell>
                <TableCell className="min-w-40">
                  <Input
                    aria-label={`${label} value ${index + 1}`}
                    className="font-mono"
                    onBlur={(event) =>
                      removeIfEmpty(row.id, "value", event.currentTarget.value)
                    }
                    onChange={(event) =>
                      updateRow(row.id, { value: event.target.value })
                    }
                    placeholder="Value"
                    value={row.value}
                  />
                </TableCell>
                <TableCell>
                  {isDraft ? null : (
                    <Button
                      aria-label={`Remove ${row.key || `${label} row ${index + 1}`}`}
                      onClick={() => removeRow(row.id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
