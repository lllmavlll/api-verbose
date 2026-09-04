export interface AssertionRule {
  id: string;
  requestRef: string;
  kind: "status" | "jsonpath" | "time";
  operator: "==" | "<" | "contains";
  path?: string;
  expected: string;
}

export interface AssertedResponse {
  status: number;
  timeMs: number;
  bodyText: string;
  isJson: boolean;
}

export interface AssertionResult {
  rule: AssertionRule;
  pass: boolean;
  label: string;
  actual: string;
  expected: string;
  reason?: string;
}
