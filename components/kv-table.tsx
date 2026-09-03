"use client";

import { KvEditorTable } from "@/components/kv-editor-table";
import { Badge } from "@/components/ui/badge";
import type { KV } from "@/lib/http/types";

type KvTableProps = {
  label: string;
  rows: KV[];
  onChange: (rows: KV[]) => void;
  overriddenKeys?: string[];
};

export function KvTable({
  label,
  rows,
  onChange,
  overriddenKeys = [],
}: KvTableProps) {
  const count = rows.filter(({ enabled, key }) => enabled && key !== "").length;

  return (
    <section
      aria-label={label}
      className="rounded-lg border bg-background/60"
      role="region"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <h2 className="text-sm font-medium">{label}</h2>
        <Badge
          className="border-transparent bg-muted font-mono text-[11px] text-muted-foreground"
          variant="outline"
        >
          {count}
        </Badge>
      </div>
      <KvEditorTable
        addDraftRow
        label={label}
        onChange={onChange}
        overriddenKeys={overriddenKeys}
        removeEmptyRowsOnBlur
        rows={rows}
      />
    </section>
  );
}
