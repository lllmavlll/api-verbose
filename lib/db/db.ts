import Dexie, { type Table } from "dexie";

import type { AssertionRule } from "@/lib/assert/types";
import type { HttpMethod, RequestSpec, SendFailure } from "@/lib/http/types";

export interface HistoryRequestSnapshot {
  method: HttpMethod;
  url: string;
}

export interface SendResultSummary {
  ok: boolean;
  status: number | null;
  statusText: string;
  timeMs: number;
  sizeBytes?: number;
  isJson: boolean;
  via?: "direct" | "relay";
  error?: Pick<SendFailure, "kind" | "message">;
}

export interface HistoryEntry {
  id: string;
  at: number;
  spec: HistoryRequestSnapshot;
  result: SendResultSummary;
}

interface AssertionRecord extends AssertionRule {
  order: number;
}

export interface SavedRequest {
  id: string;
  name: string;
  collectionId: string | null;
  spec: RequestSpec;
}

export interface Collection {
  id: string;
  name: string;
}

export class ApiVerboseDb extends Dexie {
  history!: Table<HistoryEntry, string>;
  assertions!: Table<AssertionRecord, string>;
  savedRequests!: Table<SavedRequest, string>;
  collections!: Table<Collection, string>;

  constructor() {
    super("api-verbose");
    // Sibling features extend this one database with later schema versions.
    this.version(1).stores({ history: "id, at" });
    this.version(2).stores({
      history: "id, at",
      savedRequests: "id, collectionId, name",
      collections: "id, name",
    });
    this.version(3).stores({
      history: "id, at",
      savedRequests: "id, collectionId, name",
      collections: "id, name",
      assertions: "id, requestRef, [requestRef+order]",
    });
  }
}

export const db = new ApiVerboseDb();

export async function putRule(rule: AssertionRule): Promise<void> {
  await db.transaction("rw", db.assertions, async () => {
    const existing = await db.assertions.get(rule.id);
    let order = existing?.order;

    if (order === undefined) {
      const siblings = await db.assertions
        .where("requestRef")
        .equals(rule.requestRef)
        .toArray();
      order = siblings.reduce(
        (highest, sibling) => Math.max(highest, sibling.order),
        -1,
      ) + 1;
    }

    await db.assertions.put({ ...rule, order });
  });
}

export async function getRulesFor(
  requestRef: string,
): Promise<AssertionRule[]> {
  const records = await db.assertions
    .where("requestRef")
    .equals(requestRef)
    .sortBy("order");

  return records.map(({ id, requestRef, kind, operator, path, expected }) => ({
    id,
    requestRef,
    kind,
    operator,
    path,
    expected,
  }));
}

export async function copyRulesTo(
  sourceRef: string,
  targetRef: string,
): Promise<void> {
  if (sourceRef === targetRef) return;

  await db.transaction("rw", db.assertions, async () => {
    const source = await db.assertions
      .where("requestRef")
      .equals(sourceRef)
      .sortBy("order");
    const previousTargetIds = await db.assertions
      .where("requestRef")
      .equals(targetRef)
      .primaryKeys();

    await db.assertions.bulkDelete(previousTargetIds);
    await db.assertions.bulkPut(
      source.map((assertion) => ({
        ...assertion,
        id: crypto.randomUUID(),
        requestRef: targetRef,
      })),
    );
  });
}

export async function deleteRule(id: string): Promise<void> {
  await db.assertions.delete(id);
}
