import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import type { RequestSpec, SendResult } from "@/lib/http/types";

import { db } from "./db";
import {
  HISTORY_CAP,
  addEntry,
  clearHistory,
  exportHistoryJson,
  listHistory,
  toSummary,
} from "./history";

const spec = (url: string): RequestSpec => ({
  method: "GET",
  url,
  headers: [],
  params: [],
  auth: { kind: "none" },
  body: { kind: "none" },
});

const ok: SendResult = {
  ok: true,
  via: "direct",
  status: 200,
  statusText: "OK",
  timeMs: 5,
  sizeBytes: 3,
  body: { encoding: "utf8", text: "abc" },
  isJson: false,
  headers: [],
};

beforeEach(async () => {
  await db.history.clear();
});

describe("history data access", () => {
  it("adds entries and lists them newest-first", async () => {
    await addEntry(spec("https://a.test/1"), ok, 1_000);
    await addEntry(spec("https://a.test/2"), ok, 2_000);

    expect((await listHistory()).map((row) => row.spec.url)).toEqual([
      "https://a.test/2",
      "https://a.test/1",
    ]);
  });

  it("searches method and URL case-insensitively", async () => {
    await addEntry(
      { ...spec("https://a.test/users"), method: "POST" },
      ok,
      1_000,
    );
    await addEntry(spec("https://a.test/orders"), ok, 2_000);

    expect((await listHistory({ search: "ORDER" })).map((row) => row.spec.url)).toEqual([
      "https://a.test/orders",
    ]);
    expect(await listHistory({ search: "post" })).toHaveLength(1);
    expect(await listHistory({ search: "" })).toHaveLength(2);
  });

  it("summarizes failures with a null status and their error", async () => {
    const failure: SendResult = {
      ok: false,
      kind: "invalid-headers",
      message: "Invalid header",
    };

    await addEntry(spec("https://a.test/x"), failure, 1_000, 87);

    const [row] = await listHistory();
    expect(row.result.status).toBeNull();
    expect(row.result.error).toEqual({
      kind: "invalid-headers",
      message: "Invalid header",
    });
    expect(row.result.timeMs).toBe(87);
    expect(row.result).not.toHaveProperty("sizeBytes");
  });

  it("keeps only the newest entries when writes exceed the cap", async () => {
    for (let index = 0; index < HISTORY_CAP + 5; index += 1) {
      await addEntry(spec(`https://a.test/${index}`), ok, index);
    }

    const rows = await listHistory();
    expect(rows).toHaveLength(HISTORY_CAP);
    expect(rows[0].spec.url).toBe(`https://a.test/${HISTORY_CAP + 4}`);
    expect(rows.some((row) => row.spec.url === "https://a.test/0")).toBe(false);
  });

  it("keeps concurrent sends as independent entries", async () => {
    await Promise.all([
      addEntry(spec("https://a.test/one"), ok, 1_000),
      addEntry(spec("https://a.test/two"), ok, 2_000),
    ]);

    expect(await listHistory()).toHaveLength(2);
  });

  it("clears all entries while leaving the table usable", async () => {
    await addEntry(spec("https://a.test/x"), ok, 1_000);
    await clearHistory();
    expect(await listHistory()).toEqual([]);

    await addEntry(spec("https://a.test/y"), ok, 2_000);
    expect(await listHistory()).toHaveLength(1);
  });

  it("exports the stored, capped history as pretty JSON", async () => {
    await addEntry(spec("https://a.test/x"), ok, 1_000);

    const json = await exportHistoryJson();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].spec.url).toBe("https://a.test/x");
    expect(json).toContain("\n  {");
  });

  it("keeps only response metadata in the result summary", () => {
    expect(toSummary(ok)).toEqual({
      ok: true,
      status: 200,
      statusText: "OK",
      timeMs: 5,
      sizeBytes: 3,
      isJson: false,
      via: "direct",
    });
    expect(toSummary(ok)).not.toHaveProperty("body");
    expect(toSummary(ok)).not.toHaveProperty("headers");
  });

  it("never persists credentials, arbitrary headers, auth config, or bodies", async () => {
    await addEntry(
      {
        ...spec("https://a.test/private"),
        headers: [
          {
            id: "authorization",
            key: "Authorization",
            value: "Bearer manual-secret",
            enabled: true,
          },
        ],
        auth: { kind: "bearer", token: "auth-secret" },
        body: {
          kind: "raw",
          text: "sensitive-body",
          contentType: "text/plain",
        },
      },
      ok,
      1_000,
    );

    const [row] = await listHistory();
    expect(row.spec).toEqual({
      method: "GET",
      url: "https://a.test/private",
    });
    expect(JSON.stringify(row)).not.toContain("manual-secret");
    expect(JSON.stringify(row)).not.toContain("auth-secret");
    expect(JSON.stringify(row)).not.toContain("sensitive-body");
  });
});
