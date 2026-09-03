import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const evidenceDir = process.env.EVIDENCE_DIR;

async function screenshot(page: Page, name: string) {
  if (!evidenceDir) {
    return;
  }

  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    path: path.join(evidenceDir, name),
    fullPage: true,
  });
}

async function send(page: Page, url: string) {
  await page.getByLabel("Request URL").fill(url);
  await page.getByRole("button", { name: /^send$/i }).click();
}

test("response headers and folded Set-Cookie values render as tables", async ({
  page,
}) => {
  const endpoint = new URL("https://httpbin.org/response-headers");
  endpoint.searchParams.set(
    "Set-Cookie",
    "session=abc123;Path=/;HttpOnly;Secure;SameSite=Lax",
  );
  endpoint.searchParams.set("X-Request-Id", "request-123");
  await page.route("https://httpbin.org/response-headers?*", (route) =>
    route.abort("failed"),
  );
  await page.goto("/");

  await send(page, endpoint.toString());
  await expect(page.getByText(/via relay/i)).toBeVisible({ timeout: 20_000 });

  const responseViews = page.getByRole("tablist", {
    name: "Response data views",
  });
  const responseCard = responseViews.locator(
    "xpath=ancestor::*[@data-slot='card'][1]",
  );
  const headersTab = responseViews.getByRole("tab", { name: /Headers \d+/ });
  await headersTab.click();
  const headersPanel = responseCard.getByRole("tabpanel", {
    name: /Headers \d+/,
  });
  await expect(
    headersPanel.getByRole("cell", { name: "content-type" }),
  ).toBeVisible();
  await expect(
    headersPanel.getByRole("cell", { name: "request-123" }),
  ).toBeVisible();
  await screenshot(page, "headers-populated.png");

  const cookiesTab = responseViews.getByRole("tab", { name: "Cookies 1" });
  await cookiesTab.click();
  const cookiesPanel = responseCard.getByRole("tabpanel", {
    name: "Cookies 1",
  });
  await expect(
    cookiesPanel.getByRole("cell", { name: "session", exact: true }),
  ).toBeVisible();
  await expect(
    cookiesPanel.getByRole("cell", { name: "abc123", exact: true }),
  ).toBeVisible();
  await expect(cookiesPanel.getByRole("cell", { name: "Lax" })).toBeVisible();
  await screenshot(page, "cookies-populated.png");
});

test("long header and cookie values stay inside scrollable tables", async ({
  page,
}) => {
  const longValue = "x".repeat(512);
  const endpoint = new URL("https://httpbin.org/response-headers");
  endpoint.searchParams.set("Set-Cookie", `wide=${longValue};Path=/`);
  endpoint.searchParams.set("X-Long", longValue);
  await page.setViewportSize({ width: 480, height: 900 });
  await page.route("https://httpbin.org/response-headers?*", (route) =>
    route.abort("failed"),
  );
  await page.goto("/");

  await send(page, endpoint.toString());
  await expect(page.getByText(/via relay/i)).toBeVisible({ timeout: 20_000 });
  const responseViews = page.getByRole("tablist", {
    name: "Response data views",
  });
  const responseCard = responseViews.locator(
    "xpath=ancestor::*[@data-slot='card'][1]",
  );

  await responseViews.getByRole("tab", { name: /Headers \d+/ }).click();
  const headersPanel = responseCard.getByRole("tabpanel", {
    name: /Headers \d+/,
  });
  const headerValue = headersPanel.getByRole("cell", {
    name: longValue,
    exact: true,
  });
  await expect(headerValue).toBeVisible();
  const headerContainer = headerValue.locator(
    "xpath=ancestor::div[@data-slot='table-container']",
  );
  const headerIsContained = await headerValue.evaluate((element) => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    return element.getBoundingClientRect().height > lineHeight * 2;
  });
  const headerScrollsInsideTable = await headerContainer.evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  expect(headerIsContained || headerScrollsInsideTable).toBe(true);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await responseViews.getByRole("tab", { name: "Cookies 1" }).click();
  const cookiesPanel = responseCard.getByRole("tabpanel", {
    name: "Cookies 1",
  });
  const cookieValue = cookiesPanel.getByRole("cell", {
    name: longValue,
    exact: true,
  });
  await expect(cookieValue).toBeVisible();
  const cookieContainer = cookieValue.locator(
    "xpath=ancestor::div[@data-slot='table-container']",
  );
  const cookieIsContained = await cookieValue.evaluate((element) => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    return element.getBoundingClientRect().height > lineHeight * 2;
  });
  const cookieScrollsInsideTable = await cookieContainer.evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  expect(cookieIsContained || cookieScrollsInsideTable).toBe(true);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("Cookies 0 explains when no cookie headers are visible", async ({ page }) => {
  await page.route("https://api.test/no-cookies", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-request-id": "request-456" },
      body: '{"ok":true}',
    }),
  );
  await page.goto("/");

  await send(page, "https://api.test/no-cookies");
  const responseViews = page.getByRole("tablist", {
    name: "Response data views",
  });
  await responseViews.getByRole("tab", { name: "Cookies 0" }).click();
  await expect(page.getByText("No cookies set")).toBeVisible();
  await expect(page.getByText(/browser may hide set-cookie/i)).toBeVisible();
  await screenshot(page, "cookies-empty.png");
});
