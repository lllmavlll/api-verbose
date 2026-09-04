"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runRules } from "@/lib/assert/run-rules";
import type { AssertionRule } from "@/lib/assert/types";
import type { SendResult } from "@/lib/http/types";
import { useAssertionsStore } from "@/lib/store/assertions-store";

type TestsPanelProps = {
  result: SendResult | null;
};

const KIND_LABELS: Record<AssertionRule["kind"], string> = {
  status: "Status",
  jsonpath: "JSONPath",
  time: "Response time",
};

function operatorsFor(kind: AssertionRule["kind"]) {
  if (kind === "jsonpath") {
    return [
      { value: "==" as const, label: "equals" },
      { value: "contains" as const, label: "contains" },
    ];
  }

  if (kind === "time") {
    return [{ value: "<" as const, label: "less than" }];
  }

  return [{ value: "==" as const, label: "equals" }];
}

function patchForKind(kind: AssertionRule["kind"]): Partial<AssertionRule> {
  if (kind === "jsonpath") return { kind, operator: "==", path: "$" };
  if (kind === "time") return { kind, operator: "<", path: undefined };
  return { kind, operator: "==", path: undefined };
}

export function testsBadgeCount(
  rules: AssertionRule[] = useAssertionsStore.getState().rules,
): number {
  return rules.length;
}

export function TestsPanel({ result }: TestsPanelProps) {
  const rules = useAssertionsStore((state) => state.rules);
  const addRule = useAssertionsStore((state) => state.addRule);
  const updateRule = useAssertionsStore((state) => state.updateRule);
  const removeRule = useAssertionsStore((state) => state.removeRule);
  const [storageError, setStorageError] = useState<string | null>(null);

  const results = useMemo(() => {
    if (!result?.ok) return null;

    return runRules(rules, {
      status: result.status,
      timeMs: result.timeMs,
      bodyText: result.body.encoding === "utf8" ? result.body.text : "",
      isJson: result.isJson && result.body.encoding === "utf8",
    });
  }, [result, rules]);

  const passed = results?.filter(({ pass }) => pass).length ?? 0;
  const failed = results?.length === undefined ? 0 : results.length - passed;

  function persist(mutation: Promise<void>) {
    setStorageError(null);
    void mutation.catch(() => {
      setStorageError("Assertion changes could not be saved in this browser.");
    });
  }

  return (
    <section aria-label="Response tests" className="space-y-4 px-4 pb-5 pt-3">
      {storageError ? (
        <p className="text-sm text-destructive" role="status">
          {storageError}
        </p>
      ) : null}

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <p className="font-medium">No tests yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a declarative rule to check the next completed response.
          </p>
        </div>
      ) : (
        <div className="space-y-2" aria-label="Assertion rules">
          {rules.map((rule) => (
            <div
              className="grid gap-2 rounded-lg border bg-muted/20 p-3 font-mono md:grid-cols-[minmax(9rem,0.8fr)_minmax(8rem,0.7fr)_minmax(10rem,1fr)_minmax(8rem,1fr)_auto]"
              data-testid="rule-row"
              key={rule.id}
            >
              <Select
                onValueChange={(value) => {
                  if (value) {
                    persist(
                      updateRule(
                        rule.id,
                        patchForKind(value as AssertionRule["kind"]),
                      ),
                    );
                  }
                }}
                value={rule.kind}
              >
                <SelectTrigger aria-label="Rule kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                onValueChange={(value) => {
                  if (value) {
                    persist(
                      updateRule(rule.id, {
                        operator: value as AssertionRule["operator"],
                      }),
                    );
                  }
                }}
                value={rule.operator}
              >
                <SelectTrigger aria-label="Rule operator" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operatorsFor(rule.kind).map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {rule.kind === "jsonpath" ? (
                <Input
                  aria-label="JSONPath"
                  className="font-mono"
                  onChange={(event) =>
                    persist(updateRule(rule.id, { path: event.target.value }))
                  }
                  placeholder="$.roles"
                  value={rule.path ?? ""}
                />
              ) : (
                <span
                  aria-hidden
                  className="hidden items-center px-2 text-sm text-muted-foreground md:flex"
                >
                  {rule.kind === "status" ? "HTTP status" : "milliseconds"}
                </span>
              )}

              <Input
                aria-label="Expected value"
                className="font-mono"
                inputMode={rule.kind === "jsonpath" ? "text" : "numeric"}
                onChange={(event) =>
                  persist(updateRule(rule.id, { expected: event.target.value }))
                }
                placeholder={rule.kind === "time" ? "500" : "200"}
                value={rule.expected}
              />

              <Button
                aria-label="Remove rule"
                onClick={() => persist(removeRule(rule.id))}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={() =>
          persist(
            addRule({ kind: "status", operator: "==", expected: "200" }),
          )
        }
        size="sm"
        type="button"
        variant="outline"
      >
        <Plus aria-hidden data-icon="inline-start" />
        Add rule
      </Button>

      {rules.length > 0 && result && !result.ok ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Not run — request did not complete
        </p>
      ) : null}

      {rules.length > 0 && !result ? (
        <p className="text-sm text-muted-foreground">
          Tests will run after the next completed request.
        </p>
      ) : null}

      {results && results.length > 0 ? (
        <div className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-sm font-medium">
            <span>Tests</span>
            <span aria-hidden>·</span>
            <Badge className="text-status-success" variant="outline">
              {passed} passed
            </Badge>
            <span aria-hidden>·</span>
            <Badge variant={failed > 0 ? "destructive" : "outline"}>
              {failed} failed
            </Badge>
            <span aria-hidden>·</span>
            <Badge variant="outline">{results.length} total</Badge>
            <span className="sr-only">
              Tests · {passed} passed · {failed} failed · {results.length} total
            </span>
          </div>

          <ul className="space-y-2 font-mono text-sm">
            {results.map((assertion) => (
              <li
                className="rounded-lg border px-3 py-2"
                key={assertion.rule.id}
              >
                <div className="flex items-start gap-2">
                  {assertion.pass ? (
                    <Check
                      aria-label="Passed assertion"
                      className="mt-0.5 size-4 shrink-0 text-status-success"
                    />
                  ) : (
                    <X
                      aria-label="Failed assertion"
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                    />
                  )}
                  <div className="min-w-0">
                    <p>{assertion.label}</p>
                    {assertion.pass ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Got {assertion.actual}
                      </p>
                    ) : (
                      <p className="mt-1 break-words text-xs text-destructive">
                        {assertion.reason
                          ? `${assertion.reason} · got ${assertion.actual} · expected ${assertion.expected}`
                          : `Got ${assertion.actual} · expected ${assertion.expected}`}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
