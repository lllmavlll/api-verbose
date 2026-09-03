import { expect, test } from "@playwright/test";
import path from "node:path";

test("send a request and see success and failure responses", async ({ page }) => {
  let successRequestCount = 0;
  await page.route("https://api.test/success", async (route) => {
    successRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"message":"hello"}',
    });
  });
  await page.route("https://api.test/failure", async (route) => {
    await route.abort("failed");
  });

  await page.goto("/");

  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      path: path.join(process.env.EVIDENCE_DIR, "idle.png"),
      fullPage: true,
    });
  }

  const urlInput = page.getByLabel("Request URL");
  await urlInput.fill("https://api.test/success");
  await page.getByRole("button", { name: /^send$/i }).click();

  const elapsed = page.getByText(/Sending · \d+ ms/);
  await expect(elapsed).toBeVisible();
  await expect
    .poll(async () => Number((await elapsed.textContent())?.match(/\d+/)?.[0]))
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /sending/i })).toBeDisabled();
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(100);
  expect(successRequestCount).toBe(1);
  await expect(page.getByText(/200 OK/)).toBeVisible();
  await expect(page.getByText(/"message": "hello"/)).toBeVisible();

  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      path: path.join(process.env.EVIDENCE_DIR, "success.png"),
      fullPage: true,
    });
  }

  await urlInput.fill("https://api.test/failure");
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByText(/upstream server could not be reached/i)).toBeVisible();

  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      path: path.join(process.env.EVIDENCE_DIR, "error.png"),
      fullPage: true,
    });
  }
});
