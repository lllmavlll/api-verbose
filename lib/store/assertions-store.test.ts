import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/db", () => ({
  copyRulesTo: vi.fn(async () => {}),
  putRule: vi.fn(async () => {}),
  getRulesFor: vi.fn(async () => []),
  deleteRule: vi.fn(async () => {}),
}));

import { copyRulesTo, deleteRule, getRulesFor, putRule } from "@/lib/db/db";

import { useAssertionsStore } from "./assertions-store";

beforeEach(() => {
  useAssertionsStore.setState({ rules: [], requestRef: "request-1" });
  vi.clearAllMocks();
});

describe("assertions store", () => {
  it("starts on the persistent draft scope", () => {
    useAssertionsStore.setState({ rules: [], requestRef: "draft" });

    expect(useAssertionsStore.getState().requestRef).toBe("draft");
  });

  it("adds a rule to the working set and persists it", async () => {
    await useAssertionsStore.getState().addRule({
      kind: "status",
      operator: "==",
      expected: "200",
    });

    const [stored] = useAssertionsStore.getState().rules;
    expect(stored).toMatchObject({
      kind: "status",
      requestRef: "request-1",
      expected: "200",
    });
    expect(putRule).toHaveBeenCalledWith(stored);
  });

  it("updates a rule in place and persists the new value", async () => {
    useAssertionsStore.setState({
      requestRef: "request-1",
      rules: [
        {
          id: "rule-1",
          requestRef: "request-1",
          kind: "status",
          operator: "==",
          expected: "200",
        },
      ],
    });

    await useAssertionsStore
      .getState()
      .updateRule("rule-1", { expected: "201" });

    expect(useAssertionsStore.getState().rules[0].expected).toBe("201");
    expect(putRule).toHaveBeenCalledWith(
      expect.objectContaining({ id: "rule-1", expected: "201" }),
    );
  });

  it("removes a rule and persists the deletion", async () => {
    useAssertionsStore.setState({
      requestRef: "request-1",
      rules: [
        {
          id: "rule-1",
          requestRef: "request-1",
          kind: "time",
          operator: "<",
          expected: "500",
        },
      ],
    });

    await useAssertionsStore.getState().removeRule("rule-1");

    expect(useAssertionsStore.getState().rules).toEqual([]);
    expect(deleteRule).toHaveBeenCalledWith("rule-1");
  });

  it("loads rules from persistence and swaps request scope", async () => {
    vi.mocked(getRulesFor).mockResolvedValueOnce([
      {
        id: "rule-9",
        requestRef: "request-9",
        kind: "status",
        operator: "==",
        expected: "200",
      },
    ]);

    await useAssertionsStore.getState().loadRules("request-9");

    expect(getRulesFor).toHaveBeenCalledWith("request-9");
    expect(useAssertionsStore.getState()).toMatchObject({
      requestRef: "request-9",
      rules: [expect.objectContaining({ id: "rule-9" })],
    });
  });

  it("keeps the newest scope when concurrent rule loads resolve out of order", async () => {
    let resolveFirst!: (rules: Awaited<ReturnType<typeof getRulesFor>>) => void;
    let resolveSecond!: (rules: Awaited<ReturnType<typeof getRulesFor>>) => void;
    vi.mocked(getRulesFor)
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; }),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveSecond = resolve; }),
      );

    const firstLoad = useAssertionsStore.getState().loadRules("request-1");
    const secondLoad = useAssertionsStore.getState().loadRules("request-2");
    expect(useAssertionsStore.getState()).toMatchObject({
      requestRef: "request-1",
      rules: [],
    });

    resolveSecond([
      {
        id: "rule-2",
        requestRef: "request-2",
        kind: "status",
        operator: "==",
        expected: "202",
      },
    ]);
    await expect(secondLoad).resolves.toBe(true);
    resolveFirst([
      {
        id: "rule-1",
        requestRef: "request-1",
        kind: "status",
        operator: "==",
        expected: "201",
      },
    ]);
    await expect(firstLoad).resolves.toBe(false);

    expect(useAssertionsStore.getState()).toMatchObject({
      requestRef: "request-2",
      rules: [expect.objectContaining({ id: "rule-2" })],
    });
  });

  it("treats a rejected superseded load as an unapplied selection", async () => {
    let rejectFirst!: (error: Error) => void;
    let resolveSecond!: (rules: Awaited<ReturnType<typeof getRulesFor>>) => void;
    vi.mocked(getRulesFor)
      .mockImplementationOnce(
        () => new Promise((_, reject) => { rejectFirst = reject; }),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveSecond = resolve; }),
      );

    const firstLoad = useAssertionsStore.getState().loadRules("request-1");
    const secondLoad = useAssertionsStore.getState().loadRules("request-2");
    rejectFirst(new Error("stale storage failure"));
    await expect(firstLoad).resolves.toBe(false);
    resolveSecond([
      {
        id: "rule-2",
        requestRef: "request-2",
        kind: "status",
        operator: "==",
        expected: "202",
      },
    ]);

    await expect(secondLoad).resolves.toBe(true);
    expect(useAssertionsStore.getState()).toMatchObject({
      requestRef: "request-2",
      rules: [expect.objectContaining({ id: "rule-2" })],
    });
  });

  it("restores the displayed request scope when its newest load fails", async () => {
    const previousRule = {
      id: "rule-current",
      requestRef: "request-current",
      kind: "status" as const,
      operator: "==" as const,
      expected: "200",
    };
    useAssertionsStore.setState({
      requestRef: "request-current",
      rules: [previousRule],
    });
    vi.mocked(getRulesFor).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );

    await expect(
      useAssertionsStore.getState().loadRules("request-next"),
    ).rejects.toThrow("storage unavailable");

    expect(useAssertionsStore.getState()).toMatchObject({
      requestRef: "request-current",
      rules: [previousRule],
    });
  });

  it("does not restore a failed removal into a newly selected scope", async () => {
    let rejectDelete!: (error: Error) => void;
    const oldRule = {
      id: "rule-old",
      requestRef: "request-old",
      kind: "status" as const,
      operator: "==" as const,
      expected: "secret-old-value",
    };
    const nextRule = {
      id: "rule-next",
      requestRef: "request-next",
      kind: "status" as const,
      operator: "==" as const,
      expected: "202",
    };
    useAssertionsStore.setState({
      requestRef: "request-old",
      rules: [oldRule],
    });
    vi.mocked(deleteRule).mockImplementationOnce(
      () => new Promise((_, reject) => { rejectDelete = reject; }),
    );

    const removal = useAssertionsStore.getState().removeRule(oldRule.id);
    useAssertionsStore.setState({
      requestRef: "request-next",
      rules: [nextRule],
    });
    rejectDelete(new Error("storage unavailable"));
    await expect(removal).rejects.toThrow("storage unavailable");

    expect(useAssertionsStore.getState()).toMatchObject({
      requestRef: "request-next",
      rules: [nextRule],
    });
  });

  it("snapshots the active rules under a stable request reference", async () => {
    useAssertionsStore.setState({ requestRef: "draft", rules: [] });

    await useAssertionsStore.getState().snapshotRules("history-1");

    expect(copyRulesTo).toHaveBeenCalledWith("draft", "history-1");
    expect(useAssertionsStore.getState().requestRef).toBe("draft");
  });

  it("does not mutate working state when persistence rejects", async () => {
    vi.mocked(putRule).mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      useAssertionsStore.getState().addRule({
        kind: "status",
        operator: "==",
        expected: "200",
      }),
    ).rejects.toThrow("storage unavailable");
    expect(useAssertionsStore.getState().rules).toEqual([]);
  });
});
