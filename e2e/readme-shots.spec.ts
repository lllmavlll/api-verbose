import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const screenshotsDir = path.resolve(process.cwd(), "docs/screenshots");

test.use({
  viewport: { width: 1440, height: 1200 },
});

test("capture the README workbench states", async ({ page }, testInfo) => {
  await page.route("https://readme.verbose.test/success", (route) =>
    route.fulfill({
      body: JSON.stringify({
        message: "Hello from Verbose",
        localFirst: true,
      }),
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      status: 200,
    }),
  );

  const outputDir =
    process.env.UPDATE_README_SCREENSHOTS === "1"
      ? screenshotsDir
      : testInfo.outputPath("readme-screenshots");
  await fs.mkdir(outputDir, { recursive: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Verbose" })).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    caret: "initial",
    fullPage: true,
    path: path.join(outputDir, "idle.png"),
  });

  await page
    .getByRole("textbox", { name: "Request URL" })
    .fill("https://readme.verbose.test/success");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/200 OK/)).toBeVisible();
  await expect(page.getByText(/"Hello from Verbose"/)).toBeVisible();

  await page.screenshot({
    animations: "disabled",
    caret: "initial",
    fullPage: true,
    path: path.join(outputDir, "success.png"),
  });
});
