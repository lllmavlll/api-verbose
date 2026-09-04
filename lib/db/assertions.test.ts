import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import type { AssertionRule } from "@/lib/assert/types";

import { copyRulesTo, db, deleteRule, getRulesFor, putRule } from "./db";

const makeRule = (
  id: string,
  requestRef = "request-1",
): AssertionRule => ({
  id,
  requestRef,
  kind: "status",
  operator: "==",
  expected: "200",
});

beforeEach(async () => {
  await db.open();
  await db.table("assertions").clear();
});

describe("assertion persistence", () => {
  it("registers an assertions table on the existing database", () => {
    expect(db.tables.map((table) => table.name)).toContain("assertions");
  });

  it("persists a rule and reads it back by requestRef", async () => {
    await putRule(makeRule("rule-1"));

    expect(await getRulesFor("request-1")).toEqual([makeRule("rule-1")]);
  });

  it("scopes rules to their requestRef", async () => {
    await putRule(makeRule("rule-1"));

    expect(await getRulesFor("another-request")).toEqual([]);
  });

  it("preserves rule insertion order across reads", async () => {
    await putRule(makeRule("z-first"));
    await putRule(makeRule("a-second"));

    expect((await getRulesFor("request-1")).map(({ id }) => id)).toEqual([
      "z-first",
      "a-second",
    ]);
  });

  it("updates a rule without moving it", async () => {
    await putRule(makeRule("first"));
    await putRule(makeRule("second"));
    await putRule({ ...makeRule("first"), expected: "201" });

    const rules = await getRulesFor("request-1");
    expect(rules.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(rules[0].expected).toBe("201");
  });

  it("copies rules to a stable request reference without changing the source", async () => {
    await putRule(makeRule("source-rule", "draft"));

    await copyRulesTo("draft", "history-1");

    const source = await getRulesFor("draft");
    const copied = await getRulesFor("history-1");
    expect(source).toEqual([makeRule("source-rule", "draft")]);
    expect(copied).toEqual([
      expect.objectContaining({
        requestRef: "history-1",
        kind: "status",
        expected: "200",
      }),
    ]);
    expect(copied[0].id).not.toBe(source[0].id);
  });

  it("deletes a rule by id", async () => {
    await putRule(makeRule("rule-1"));
    await deleteRule("rule-1");

    expect(await getRulesFor("request-1")).toEqual([]);
  });
});
