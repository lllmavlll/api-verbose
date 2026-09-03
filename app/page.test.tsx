import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RequestSpec } from "@/lib/http/types";

const { sendRequest } = vi.hoisted(() => ({
  sendRequest: vi.fn(async (spec: RequestSpec) => {
    void spec;
    return {
      ok: true as const,
      status: 200,
      statusText: "OK",
      timeMs: 1,
      sizeBytes: 2,
      bodyText: "{}",
      isJson: true,
      headers: [] as [string, string][],
    };
  }),
}));

vi.mock("@/lib/http/send-request", () => ({ sendRequest }));

import { useRequestStore } from "@/lib/store/request-store";

import Page from "./page";

beforeEach(() => {
  useRequestStore.getState().reset();
  sendRequest.mockClear();
});

it("composes auth into the spec handed to the send seam", async () => {
  const user = userEvent.setup();
  useRequestStore.getState().setUrl("https://httpbin.org/get");
  useRequestStore.getState().setAuth({ kind: "bearer", token: "T" });
  render(<Page />);

  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(sendRequest).toHaveBeenCalledOnce();
  expect(sendRequest.mock.calls[0]?.[0]).toMatchObject({
    url: "https://httpbin.org/get",
    auth: { kind: "none" },
    headers: [expect.objectContaining({ key: "Authorization", value: "Bearer T" })],
  });
});

it("sends only enabled named manual rows", async () => {
  const user = userEvent.setup();
  useRequestStore.getState().loadSpec({
    method: "GET",
    url: "https://x.test/p?a=1",
    params: [
      { id: "a", key: "a", value: "1", enabled: true },
      { id: "b", key: "b", value: "2", enabled: false },
    ],
    headers: [
      { id: "one", key: "X-Test", value: "yes", enabled: true },
      { id: "two", key: "X-Off", value: "no", enabled: false },
    ],
    auth: { kind: "none" },
    body: { kind: "none" },
  });
  render(<Page />);

  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(sendRequest.mock.calls[0]?.[0]).toMatchObject({
    url: "https://x.test/p?a=1",
    headers: [expect.objectContaining({ key: "X-Test", value: "yes" })],
  });
});

it("reports an incomplete percent escape instead of throwing on Send", async () => {
  const user = userEvent.setup();
  useRequestStore.getState().setUrl("https://x.test/p?a=%");
  render(<Page />);

  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(sendRequest).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(/valid.*url/i);
});
