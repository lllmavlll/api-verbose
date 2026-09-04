import { JSONPath } from "jsonpath-plus";

import type {
  AssertedResponse,
  AssertionResult,
  AssertionRule,
} from "./types";

function parseExpected(text: string): number | boolean | string {
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }

  if (text === "true") return true;
  if (text === "false") return false;

  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  ) {
    return text.slice(1, -1);
  }

  return text;
}

function display(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";

  const serialized = JSON.stringify(value);
  return serialized ?? String(value);
}

function isStructurallyValidPath(path: string): boolean {
  if (!path.startsWith("$")) return false;

  let bracketDepth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const character of path) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\" && quote) {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[") {
      bracketDepth += 1;
    } else if (character === "]") {
      bracketDepth -= 1;
      if (bracketDepth < 0) return false;
    }
  }

  return bracketDepth === 0 && quote === null;
}

function baseResult(
  rule: AssertionRule,
  label: string,
  actual: unknown,
  pass: boolean,
): AssertionResult {
  return {
    rule,
    pass,
    label,
    actual: display(actual),
    expected: rule.expected,
  };
}

function errorResult(
  rule: AssertionRule,
  label: string,
  reason: string,
  actual = "unavailable",
): AssertionResult {
  return {
    ...baseResult(rule, label, actual, false),
    reason,
  };
}

function runStatus(
  rule: AssertionRule,
  response: AssertedResponse,
): AssertionResult {
  const label = `status == ${rule.expected}`;
  const expected = parseExpected(rule.expected);
  return baseResult(rule, label, response.status, response.status === expected);
}

function runTime(
  rule: AssertionRule,
  response: AssertedResponse,
): AssertionResult {
  const label = `response time < ${rule.expected} ms`;
  const expected = parseExpected(rule.expected);
  const pass = typeof expected === "number" && response.timeMs < expected;
  return baseResult(rule, label, Math.round(response.timeMs), pass);
}

function runJsonPath(
  rule: AssertionRule,
  response: AssertedResponse,
): AssertionResult {
  const path = rule.path?.trim() ?? "";
  const label = `${path || "JSONPath"} ${rule.operator} ${rule.expected}`;

  if (!isStructurallyValidPath(path)) {
    return errorResult(rule, label, "invalid JSONPath");
  }

  if (!response.isJson) {
    return errorResult(rule, label, "body is not JSON");
  }

  let json: null | boolean | number | string | object | unknown[];
  try {
    json = JSON.parse(response.bodyText);
  } catch {
    return errorResult(rule, label, "body is not JSON");
  }

  let matches: unknown[];
  try {
    matches = JSONPath<unknown[]>({ path, json, wrap: true, eval: false });
  } catch {
    return errorResult(rule, label, "invalid JSONPath");
  }

  if (matches.length === 0) {
    return errorResult(rule, label, `no match for \`${path}\``);
  }

  const actual = matches[0];
  const expected = parseExpected(rule.expected);

  if (rule.operator === "contains") {
    const pass = Array.isArray(actual)
      ? actual.some((item) => Object.is(item, expected))
      : typeof actual === "string" && typeof expected === "string"
        ? actual.includes(expected)
        : false;
    return baseResult(rule, label, actual, pass);
  }

  return baseResult(rule, label, actual, Object.is(actual, expected));
}

function runRule(
  rule: AssertionRule,
  response: AssertedResponse,
): AssertionResult {
  if (rule.kind === "status") return runStatus(rule, response);
  if (rule.kind === "time") return runTime(rule, response);
  return runJsonPath(rule, response);
}

export function runRules(
  rules: AssertionRule[],
  response: AssertedResponse,
): AssertionResult[] {
  return rules.map((rule) => runRule(rule, response));
}
