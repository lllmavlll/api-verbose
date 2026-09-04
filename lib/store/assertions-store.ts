import { create } from "zustand";

import type { AssertionRule } from "@/lib/assert/types";
import { copyRulesTo, deleteRule, getRulesFor, putRule } from "@/lib/db/db";

type RuleInput = Omit<AssertionRule, "id" | "requestRef">;
type RulePatch = Partial<RuleInput>;
let latestLoad = 0;

export interface AssertionsState {
  rules: AssertionRule[];
  requestRef: string;
  loadRules(requestRef: string): Promise<boolean>;
  snapshotRules(requestRef: string): Promise<void>;
  addRule(input: RuleInput): Promise<void>;
  updateRule(id: string, patch: RulePatch): Promise<void>;
  removeRule(id: string): Promise<void>;
}

export const useAssertionsStore = create<AssertionsState>((set, get) => ({
  rules: [],
  requestRef: "draft",
  loadRules: async (requestRef) => {
    const generation = ++latestLoad;
    let persistedRules: AssertionRule[];
    try {
      persistedRules = await getRulesFor(requestRef);
    } catch (error) {
      if (generation !== latestLoad) return false;
      throw error;
    }
    if (generation !== latestLoad) return false;

    set(({ requestRef: activeRequestRef, rules }) => {
      const activeRules = activeRequestRef === requestRef ? rules : [];
      const activeIds = new Set(activeRules.map((rule) => rule.id));
      return {
        requestRef,
        rules: [
          ...persistedRules.filter((rule) => !activeIds.has(rule.id)),
          ...activeRules,
        ],
      };
    });
    return true;
  },
  snapshotRules: async (requestRef) => {
    await copyRulesTo(get().requestRef, requestRef);
  },
  addRule: async (input) => {
    const assertion: AssertionRule = {
      ...input,
      id: crypto.randomUUID(),
      requestRef: get().requestRef,
    };
    set(({ rules }) => ({ rules: [...rules, assertion] }));
    try {
      await putRule(assertion);
    } catch (error) {
      set(({ rules }) => ({
        rules: rules.filter((candidate) => candidate.id !== assertion.id),
      }));
      throw error;
    }
  },
  updateRule: async (id, patch) => {
    const assertion = get().rules.find((candidate) => candidate.id === id);
    if (!assertion) return;

    const updated = { ...assertion, ...patch };
    set(({ rules }) => ({
      rules: rules.map((candidate) =>
        candidate.id === id ? updated : candidate,
      ),
    }));
    try {
      await putRule(updated);
    } catch (error) {
      set(({ rules }) => ({
        rules: rules.map((candidate) =>
          candidate === updated ? assertion : candidate,
        ),
      }));
      throw error;
    }
  },
  removeRule: async (id) => {
    const index = get().rules.findIndex((candidate) => candidate.id === id);
    if (index === -1) return;
    const assertion = get().rules[index];
    set(({ rules }) => ({
      rules: rules.filter((candidate) => candidate.id !== id),
    }));
    try {
      await deleteRule(id);
    } catch (error) {
      set(({ requestRef, rules }) => {
        if (requestRef !== assertion.requestRef) return {};
        const next = [...rules];
        next.splice(index, 0, assertion);
        return { rules: next };
      });
      throw error;
    }
  },
}));
