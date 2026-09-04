import { describe, expect, it } from "vitest";

import { runRules } from "./run-rules";
import type { AssertedResponse, AssertionRule } from "./types";

const response = (
  overrides: Partial<AssertedResponse> = {},
): AssertedResponse => ({
  status: 200,
  timeMs: 128,
  bodyText: '{"roles":["admin","editor"],"n":5}',
  isJson: true,
  ...overrides,
});

const rule = (overrides: Partial<AssertionRule>): AssertionRule => ({
  id: "rule-1",
  requestRef: "request-1",
  kind: "status",
  operator: "==",
  expected: "200",
  ...overrides,
});

describe("runRules", () => {
  it("passes status equality with a type-aware numeric expected value", () => {
    const [result] = runRules(
      [rule({ kind: "status", operator: "==", expected: "200" })],
      response({ status: 200 }),
    );

    expect(result.pass).toBe(true);
    expect(result.actual).toBe("200");
  });

  it("fails status equality and reports actual versus expected", () => {
    const [result] = runRules(
      [rule({ kind: "status", operator: "==", expected: "201" })],
      response({ status: 200 }),
    );

    expect(result).toMatchObject({
      pass: false,
      actual: "200",
      expected: "201",
    });
  });

  it("passes a response-time threshold and shows the actual milliseconds", () => {
    const [result] = runRules(
      [rule({ kind: "time", operator: "<", expected: "500" })],
      response({ timeMs: 128 }),
    );

    expect(result.pass).toBe(true);
    expect(result.actual).toBe("128");
  });

  it("fails a response-time threshold when the response is slower", () => {
    const [result] = runRules(
      [rule({ kind: "time", operator: "<", expected: "100" })],
      response({ timeMs: 128 }),
    );

    expect(result.pass).toBe(false);
  });

  it("deep-equals a JSONPath resolved value", () => {
    const [result] = runRules(
      [rule({ kind: "jsonpath", operator: "==", path: "$.n", expected: "5" })],
      response(),
    );

    expect(result.pass).toBe(true);
  });

  it("reports both sides of a JSONPath value mismatch", () => {
    const [result] = runRules(
      [rule({ kind: "jsonpath", operator: "==", path: "$.n", expected: "6" })],
      response(),
    );

    expect(result.pass).toBe(false);
    expect(result.actual).toBe("5");
    expect(result.expected).toBe("6");
  });

  it("checks array membership for JSONPath contains", () => {
    const [passing, failing] = runRules(
      [
        rule({
          id: "pass",
          kind: "jsonpath",
          operator: "contains",
          path: "$.roles",
          expected: "admin",
        }),
        rule({
          id: "fail",
          kind: "jsonpath",
          operator: "contains",
          path: "$.roles",
          expected: "owner",
        }),
      ],
      response(),
    );

    expect(passing.pass).toBe(true);
    expect(failing.pass).toBe(false);
    expect(failing.actual).toBe('["admin","editor"]');
  });

  it("checks substring membership for JSONPath contains", () => {
    const [result] = runRules(
      [
        rule({
          kind: "jsonpath",
          operator: "contains",
          path: "$.message",
          expected: "world",
        }),
      ],
      response({ bodyText: '{"message":"hello world"}' }),
    );

    expect(result.pass).toBe(true);
  });

  it("fails a zero-match path with a readable reason instead of throwing", () => {
    const [result] = runRules(
      [
        rule({
          kind: "jsonpath",
          operator: "==",
          path: "$.missing",
          expected: "x",
        }),
      ],
      response(),
    );

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/no match/i);
  });

  it("fails a malformed path with an invalid-path reason", () => {
    const [result] = runRules(
      [rule({ kind: "jsonpath", operator: "==", path: "$[", expected: "x" })],
      response(),
    );

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/invalid jsonpath/i);
  });

  it("fails a JSONPath rule when the response body is not JSON", () => {
    const [result] = runRules(
      [rule({ kind: "jsonpath", operator: "==", path: "$.a", expected: "x" })],
      response({ bodyText: "oops", isJson: false }),
    );

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/not json/i);
  });

  it("fails a JSONPath rule when a purported JSON body cannot be parsed", () => {
    const [result] = runRules(
      [rule({ kind: "jsonpath", operator: "==", path: "$.a", expected: "x" })],
      response({ bodyText: "{", isJson: true }),
    );

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/not json/i);
  });

  it("compares booleans and quoted strings with type awareness", () => {
    const [booleanResult, stringResult] = runRules(
      [
        rule({
          id: "boolean",
          kind: "jsonpath",
          operator: "==",
          path: "$.active",
          expected: "true",
        }),
        rule({
          id: "string",
          kind: "jsonpath",
          operator: "==",
          path: "$.role",
          expected: '"admin"',
        }),
      ],
      response({ bodyText: '{"active":true,"role":"admin"}' }),
    );

    expect(booleanResult.pass).toBe(true);
    expect(stringResult.pass).toBe(true);
  });

  it("returns results in rule-definition order", () => {
    const results = runRules(
      [
        rule({ id: "first", expected: "200" }),
        rule({ id: "second", expected: "201" }),
      ],
      response(),
    );

    expect(results.map((result) => result.rule.id)).toEqual(["first", "second"]);
  });

  it("returns no results for an empty rule list", () => {
    expect(runRules([], response())).toEqual([]);
  });
});
