import { beforeEach, describe, expect, it } from "vitest";

import type { Body } from "@/lib/http/types";

import { useRequestStore } from "./request-store";

beforeEach(() => {
  useRequestStore.setState({
    spec: {
      method: "POST",
      url: "",
      headers: [],
      params: [],
      auth: { kind: "none" },
      body: { kind: "none" },
    },
  });
});

describe("setBody", () => {
  it("replaces spec.body with the given body", () => {
    const next: Body = { kind: "json", text: '{"a":1}' };

    useRequestStore.getState().setBody(next);

    expect(useRequestStore.getState().spec.body).toEqual(next);
  });

  it("leaves the rest of the spec untouched", () => {
    useRequestStore.getState().setBody({ kind: "form", fields: [] });

    const spec = useRequestStore.getState().spec;
    expect(spec.method).toBe("POST");
    expect(spec.headers).toEqual([]);
  });
});
