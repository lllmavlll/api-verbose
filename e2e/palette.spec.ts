import { expect, test } from "@playwright/test";
import path from "node:path";

test("palette opens, filters, and the shortcut list is reachable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-ready", "true");
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder(/type a command/i);
  await expect(input).toBeVisible();
  const palette = page.getByRole("dialog", { name: /command palette/i });
  await expect(input).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect
    .poll(() =>
      palette.evaluate((dialog) => dialog.contains(document.activeElement)),
    )
    .toBe(true);

  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      animations: "disabled",
      path: path.join(process.env.EVIDENCE_DIR, "palette-open.png"),
      fullPage: true,
    });
  }

  await input.fill("method");
  await expect(page.getByText(/switch method/i).first()).toBeVisible();

  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      animations: "disabled",
      path: path.join(process.env.EVIDENCE_DIR, "palette-filtered.png"),
      fullPage: true,
    });
  }

  await input.fill("Focus URL");
  await page.keyboard.press("Enter");
  await expect(input).toBeHidden();
  await expect(page.getByLabel("Request URL")).toBeFocused();
  await page.getByRole("combobox", { name: /http method/i }).focus();
  await page.keyboard.press("?");
  await expect(
    page.getByRole("dialog", { name: /keyboard shortcuts/i }),
  ).toBeVisible();

  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      animations: "disabled",
      path: path.join(process.env.EVIDENCE_DIR, "shortcuts-help.png"),
      fullPage: true,
    });
  }
});

test("builds and sends a request by keyboard alone", async ({ page }) => {
  let receivedRequest:
    | { method: string; url: string; headers: Record<string, string> }
    | undefined;
  let requestCount = 0;
  await page.route("https://api.test/**", async (route) => {
    requestCount += 1;
    receivedRequest = {
      method: route.request().method(),
      url: route.request().url(),
      headers: route.request().headers(),
    };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"created":true}',
    });
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-ready", "true");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder(/type a command/i).fill("POST");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("combobox", { name: /http method/i }),
  ).toContainText("POST");

  await page.keyboard.press("ControlOrMeta+\\");
  const urlInput = page.getByLabel("Request URL");
  await expect(urlInput).toBeFocused();
  await page.keyboard.type("https://api.test/command");

  const params = page.getByRole("region", { name: "Query Params" });
  await params.getByPlaceholder("Key").first().fill("draft");
  await params.getByPlaceholder("Value").first().fill("kept");
  const headers = page.getByRole("region", { name: "Headers" });
  await headers.getByPlaceholder("Key").first().fill("X-Manual");
  await headers.getByPlaceholder("Value").first().fill("yes");
  await page.getByRole("combobox", { name: "Auth preset" }).click();
  await page.getByRole("option", { name: "Bearer token" }).click();
  await page.getByLabel("Token").fill("T");

  await page.keyboard.press("ControlOrMeta+Enter");

  await expect(
    page.locator("[aria-live='polite']").filter({ hasText: "201 Created" }),
  ).toBeVisible();
  await expect(page.locator("pre.shiki")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/"created": true/)).toBeVisible();
  expect(receivedRequest).toMatchObject({
    method: "POST",
    url: "https://api.test/command?draft=kept",
    headers: expect.objectContaining({
      authorization: "Bearer T",
      "x-manual": "yes",
    }),
  });
  expect(requestCount).toBe(1);
});
