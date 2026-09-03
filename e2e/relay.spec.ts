import { expect, test } from "@playwright/test";
import path from "node:path";

test("a browser-blocked public request succeeds through the relay", async ({
  page,
}) => {
  await page.route("https://api.github.com/**", (route) =>
    route.abort("failed"),
  );
  await page.goto("/");

  await page
    .getByLabel("Request URL")
    .fill("https://api.github.com/users/octocat");
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByText(/200 OK/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/via relay/i)).toBeVisible();
  await expect(page.getByText(/"login": "octocat"/)).toBeVisible();

  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      path: path.join(process.env.EVIDENCE_DIR, "relay-success.png"),
      fullPage: true,
    });
  }
});

test("a redirected binary response survives the real relay route into Preview", async ({
  page,
}) => {
  const startUrl =
    "https://httpbin.org/redirect-to?url=/image/png&status_code=302";
  const composedStartUrl =
    "https://httpbin.org/redirect-to?url=%2Fimage%2Fpng&status_code=302";
  await page.route(/^https:\/\/httpbin\.org\/redirect-to\?/, (route) =>
    route.abort("failed"),
  );
  await page.goto("/");

  const relayResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/relay") &&
      response.request().method() === "POST",
  );
  await page.getByLabel("Request URL").fill(startUrl);
  await page.getByRole("button", { name: /^send$/i }).click();

  const relayResult = (await (await relayResponse).json()) as {
    ok: boolean;
    status: number;
    sizeBytes: number;
    bodyBase64: string;
    redirects: { url: string; status: number }[];
  };
  expect(relayResult).toMatchObject({
    ok: true,
    status: 200,
    sizeBytes: 8090,
    redirects: [
      { url: composedStartUrl, status: 302 },
      { url: "https://httpbin.org/image/png", status: 200 },
    ],
  });
  expect(Buffer.from(relayResult.bodyBase64, "base64")).toHaveLength(
    relayResult.sizeBytes,
  );
  expect(
    Array.from(Buffer.from(relayResult.bodyBase64, "base64").subarray(0, 8)),
  ).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

  await expect(page.getByText(/via relay/i)).toBeVisible();
  await page.getByRole("tab", { name: /^preview$/i }).click();
  const image = page.getByRole("img", { name: "Response preview" });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
});

test("a request body reaches the upstream through the real Node relay transport", async ({
  request,
}) => {
  const response = await request.post("/api/relay", {
    data: {
      method: "PUT",
      url: "https://httpbin.org/anything",
      headers: [["content-type", "text/plain"]],
      body: "hello through relay",
    },
  });
  expect(response.ok()).toBe(true);

  const relayResult = (await response.json()) as {
    ok: boolean;
    bodyBase64: string;
    sizeBytes: number;
  };
  expect(relayResult.ok).toBe(true);
  expect(relayResult.sizeBytes).toBeGreaterThan(0);
  const upstreamEcho = JSON.parse(
    Buffer.from(relayResult.bodyBase64, "base64").toString("utf8"),
  ) as {
    data: string;
    headers: Record<string, string>;
  };
  expect(upstreamEcho.data).toBe("hello through relay");
  expect(upstreamEcho.headers["Content-Type"]).toBe("text/plain");
});

test("a metadata target is blocked with a named relay error", async ({ page }) => {
  await page.route("http://169.254.169.254/**", (route) =>
    route.abort("failed"),
  );
  await page.goto("/");

  await page
    .getByLabel("Request URL")
    .fill("http://169.254.169.254/latest/meta-data/");
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(
    page.getByText(/blocked: target address is not allowed/i),
  ).toBeVisible({ timeout: 20_000 });

  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      path: path.join(process.env.EVIDENCE_DIR, "relay-error.png"),
      fullPage: true,
    });
  }
});

test("builder headers and auth reach relay fallback as ordered tuples", async ({
  page,
}) => {
  let relayPayload: unknown;
  await page.route("https://api.test/**", (route) => route.abort("failed"));
  await page.route("**/api/relay", async (route) => {
    relayPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: [],
        bodyBase64: "cmVsYXllZA==",
        sizeBytes: 7,
      }),
    });
  });
  await page.goto("/");

  await page.getByLabel("Request URL").fill("https://api.test/echo");
  const headers = page.getByRole("region", { name: "Headers" });
  await headers.getByPlaceholder("Key").first().fill("X-Test");
  await headers.getByPlaceholder("Value").first().fill("one");
  await headers.getByPlaceholder("Key").nth(1).fill("X-Test");
  await headers.getByPlaceholder("Value").nth(1).fill("two");
  await page.getByRole("combobox", { name: "Auth preset" }).click();
  await page.getByRole("option", { name: "Bearer token" }).click();
  await page.getByLabel("Token").fill("secret-token");

  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByText(/via relay/i)).toBeVisible();
  await expect.poll(() => relayPayload).toEqual({
    method: "GET",
    url: "https://api.test/echo",
    headers: [
      ["X-Test", "one"],
      ["X-Test", "two"],
      ["Authorization", "Bearer secret-token"],
    ],
  });
});
