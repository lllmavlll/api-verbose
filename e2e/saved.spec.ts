import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

async function capture(page: Page, name: string) {
  const evidenceDir =
    process.env.EVIDENCE_DIR ??
    ".vegastack/.tmp/9-saved-requests-collections/evidence";
  await page.screenshot({
    caret: "initial",
    fullPage: true,
    path: path.join(evidenceDir, name),
  });
}

test("saves a complete request into a collection, reloads, and opens it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Saved requests" })).toBeVisible();
  await capture(page, "saved-empty.png");

  await page.getByRole("button", { name: /import curl/i }).click();
  await page
    .getByRole("textbox", { name: /curl command/i })
    .fill(
      `curl -X POST 'https://api.github.com/zen?page=2' -H 'Accept: application/json' -H 'X-Secret: explicit' -u 'ada:lovelace' -d '{"saved":true}'`,
    );
  await page.getByRole("button", { name: /^import$/i }).click();

  await page.getByRole("button", { name: /save request/i }).click();
  await capture(page, "saved-dialog.png");
  await page.getByRole("combobox", { name: "Collection" }).click();
  await page.getByRole("option", { name: /new collection/i }).click();
  await page.getByRole("textbox", { name: /new collection name/i }).fill("GitHub");
  await page.getByRole("button", { name: /^create$/i }).click();
  await page.getByRole("combobox", { name: "Collection" }).click();
  await page.getByRole("option", { name: "GitHub" }).click();
  await page.getByRole("button", { name: /^save$/i }).click();

  const row = page.getByRole("button", { name: /open post post api\.github\.com\/zen/i });
  await expect(row).toBeVisible();
  await capture(page, "saved-populated.png");

  await page.reload();
  await expect(row).toBeVisible();

  await page.getByLabel("Request URL").fill("https://replace.test/current");
  await row.click();
  await expect(page.getByLabel("Request URL")).toHaveValue(
    "https://api.github.com/zen?page=2",
  );
  await expect(page.getByRole("combobox", { name: "HTTP method" })).toContainText(
    "POST",
  );
  await expect(page.getByLabel("Username")).toHaveValue("ada");
  await expect(page.getByLabel("Password")).toHaveValue("lovelace");
  await expect(page.locator(".cm-content")).toContainText('"saved"');
});

test("renames, moves, and deletes saved requests without sending them", async ({
  page,
}) => {
  let sends = 0;
  await page.route("https://saved.test/**", async (route) => {
    sends += 1;
    await route.fulfill({ body: "unexpected" });
  });
  await page.goto("/");
  await page.getByLabel("Request URL").fill("https://saved.test/item");
  await page.getByRole("button", { name: /save request/i }).click();
  await page.getByRole("button", { name: /^save$/i }).click();

  await page
    .getByRole("button", { name: /actions for saved request get saved\.test\/item/i })
    .click();
  await page.getByRole("menuitem", { name: /^rename$/i }).click();
  await page.getByRole("textbox", { name: /^name$/i }).fill("Health check");
  await page.getByRole("button", { name: /save name/i }).click();
  await expect(page.getByRole("button", { name: /open get health check/i })).toBeVisible();

  await page.getByRole("button", { name: /new collection/i }).click();
  await page.getByRole("textbox", { name: /collection name/i }).fill("Ops");
  await page.getByRole("button", { name: /^create$/i }).click();
  await page
    .getByRole("button", { name: /actions for saved request health check/i })
    .click();
  await page.getByRole("menuitem", { name: /move to/i }).hover();
  await page.getByRole("menuitem", { name: "Ops" }).click();
  await expect(page.getByRole("button", { name: /ops collection, 1 request/i }))
    .toBeVisible();

  await page
    .getByRole("button", { name: /actions for collection ops/i })
    .click();
  await page.getByRole("menuitem", { name: /^rename$/i }).click();
  await page.getByRole("textbox", { name: /^name$/i }).fill("Platform");
  await page.getByRole("button", { name: /save name/i }).click();
  await expect(
    page.getByRole("button", { name: /platform collection, 1 request/i }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /actions for collection platform/i })
    .click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();
  await page.getByRole("button", { name: /move to ungrouped/i }).click();
  await expect(page.getByRole("button", { name: /open get health check/i })).toBeVisible();

  await page
    .getByRole("button", { name: /actions for saved request health check/i })
    .click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();
  await expect(page.getByText(/no saved requests yet/i)).toBeVisible();
  expect(sends).toBe(0);
});
