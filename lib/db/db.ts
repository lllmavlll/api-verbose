import Dexie, { type Table } from "dexie";

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
  }
}

export const db = new ApiVerboseDb();
