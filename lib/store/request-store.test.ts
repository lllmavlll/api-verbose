import { beforeEach, expect, it } from "vitest";

import { INITIAL_SPEC, useRequestStore } from "./request-store";

beforeEach(() => useRequestStore.getState().reset());

it("editing the URL populates param rows", () => {
  useRequestStore.getState().setUrl("https://x.test/p?a=1&b=2");

  expect(
    useRequestStore
      .getState()
      .spec.params.map(({ key, value }) => [key, value]),
  ).toEqual([
    ["a", "1"],
    ["b", "2"],
  ]);
});

it("editing enabled rows rewrites the URL", () => {
  useRequestStore.getState().setUrl("https://x.test/p");
  useRequestStore
    .getState()
    .setParams([{ id: "1", key: "q", value: "hi", enabled: true }]);

  expect(useRequestStore.getState().spec.url).toBe("https://x.test/p?q=hi");
});

it("drops a disabled row from the URL while keeping it in state", () => {
  useRequestStore.getState().setUrl("https://x.test/p");
  useRequestStore.getState().setParams([
    { id: "1", key: "a", value: "1", enabled: false },
    { id: "2", key: "b", value: "2", enabled: true },
  ]);

  expect(useRequestStore.getState().spec.url).toBe("https://x.test/p?b=2");
  expect(useRequestStore.getState().spec.params).toHaveLength(2);
});

it("keeps existing rows when a partial percent escape cannot be parsed", () => {
  useRequestStore.getState().setUrl("https://x.test/p?a=1");
  useRequestStore.getState().setUrl("https://x.test/p?a=%");

  expect(useRequestStore.getState().spec.url).toBe("https://x.test/p?a=%");
  expect(useRequestStore.getState().spec.params[0]).toMatchObject({
    key: "a",
    value: "1",
  });
});

it("loads a complete spec for future request replay", () => {
  useRequestStore.getState().loadSpec({
    ...INITIAL_SPEC,
    method: "POST",
    url: "https://x.test/p?loaded=yes",
    params: [{ id: "loaded", key: "loaded", value: "yes", enabled: true }],
  });

  expect(useRequestStore.getState().spec).toMatchObject({
    method: "POST",
    url: "https://x.test/p?loaded=yes",
  });
});

it("reset returns to a fresh initial spec", () => {
  useRequestStore.getState().setMethod("POST");
  useRequestStore.getState().reset();

  expect(useRequestStore.getState().spec).toEqual(INITIAL_SPEC);
});
