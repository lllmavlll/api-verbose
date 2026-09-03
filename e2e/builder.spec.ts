import { expect, test } from "@playwright/test";
import path from "node:path";

async function capture(page: import("@playwright/test").Page, name: string) {
  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      path: path.join(process.env.EVIDENCE_DIR, name),
      caret: "initial",
      fullPage: true,
    });
  }
}

test("build a request with synced params, headers, and auth", async ({ page }) => {
  let lastRequest: { url: string; headers: Record<string, string> } | null = null;
  await page.route("https://api.test/**", async (route) => {
    lastRequest = {
      url: route.request().url(),
      headers: route.request().headers(),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(lastRequest),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("region", { name: "Query Params" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Headers" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Auth" })).toBeVisible();
  await capture(page, "builder-empty.png");

  const url = page.getByRole("textbox", { name: "Request URL" });
  await url.fill("https://api.test/echo");
  const params = page.getByRole("region", { name: "Query Params" });
  await params.getByPlaceholder("Key").first().fill("greeting");
  await params.getByPlaceholder("Value").first().fill("hi there");
  await expect(url).toHaveValue("https://api.test/echo?greeting=hi%20there");

  await params.getByRole("checkbox", { name: "Enable greeting" }).click();
  await expect(url).toHaveValue("https://api.test/echo");
  await params.getByRole("checkbox", { name: "Enable greeting" }).click();
  await expect(url).toHaveValue("https://api.test/echo?greeting=hi%20there");

  const headers = page.getByRole("region", { name: "Headers" });
  await headers.getByPlaceholder("Key").first().fill("X-Test");
  await headers.getByPlaceholder("Value").first().fill("sent");
  await capture(page, "builder-url-sync.png");

  await page.getByRole("combobox", { name: "Auth preset" }).click();
  await page.getByRole("option", { name: "Bearer token" }).click();
  await page.getByLabel("Token").fill("secret-token");
  await capture(page, "builder-auth-bearer.png");

  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/200 OK/)).toBeVisible();
  await expect(page.getByText(/Bearer secret-token/)).toBeVisible();
  expect(lastRequest).toMatchObject({
    url: "https://api.test/echo?greeting=hi%20there",
    headers: expect.objectContaining({
      authorization: "Bearer secret-token",
      "x-test": "sent",
    }),
  });

  await page.getByRole("combobox", { name: "Auth preset" }).click();
  await page.getByRole("option", { name: "API key" }).click();
  await page.getByLabel("API key name").fill("api_key");
  await page.getByLabel("API key value").fill("key-value");
  await page.getByRole("tab", { name: "Query param" }).click();
  await expect(page.getByRole("tab", { name: "Query param" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await capture(page, "builder-auth-api-key.png");

  await page.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => lastRequest?.url).toBe(
    "https://api.test/echo?greeting=hi%20there&api_key=key-value",
  );
});

test("editing the URL query populates the param table", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Request URL" })
    .fill("https://api.test/echo?a=1&a=2&q=a%20b%26c");

  const params = page.getByRole("region", { name: "Query Params" });
  await expect(params.getByPlaceholder("Key")).toHaveCount(4);
  await expect(params.getByPlaceholder("Value").nth(2)).toHaveValue("a b&c");
});

test("preserves immediate URL entry across hydration", async ({ page }) => {
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 750));
    await route.continue();
  });

  await page.goto("/", { waitUntil: "commit" });
  const url = page.getByRole("textbox", { name: "Request URL" });
  await url.fill("https://api.test/echo?early=yes");

  await expect(url).toHaveValue("https://api.test/echo?early=yes");
  await expect(
    page.getByRole("region", { name: "Query Params" }).getByPlaceholder("Key"),
  ).toHaveCount(2);
});
