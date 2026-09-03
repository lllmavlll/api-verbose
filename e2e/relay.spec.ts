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
