import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const evidenceDir =
  process.env.EVIDENCE_DIR ??
  path.join(
    process.cwd(),
    ".vegastack/.tmp/11-response-assertions/evidence",
  );

async function capture(page: Page, name: string) {
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(evidenceDir, name),
  });
}

async function choose(
  row: ReturnType<Page["getByTestId"]>,
  label: string,
  option: string,
) {
  await row.getByRole("combobox", { name: label }).click();
  await row.page().getByRole("option", { name: option }).click();
}

test("tests tab covers empty, all-pass, mixed, not-run, and reload states", async ({
  page,
}) => {
  await page.route("https://assertions.test/data", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ roles: ["admin", "editor"] }),
    }),
  );
  await page.route("https://assertions.test/failure", (route) =>
    route.abort("failed"),
  );
  await page.route("**/api/relay", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: "upstream-unreachable",
        message: "simulated failure",
      }),
    }),
  );
  await page.goto("/");

  const testsTab = page.getByRole("tab", { name: /tests/i });
  await testsTab.click();
  await expect(page.getByText(/no tests yet/i)).toBeVisible();
  await capture(page, "tests-empty.png");

  await page.getByRole("button", { name: /add rule/i }).click();
  await expect(page.getByTestId("rule-row")).toHaveCount(1);

  await page.reload();
  await page.getByRole("tab", { name: /tests/i }).click();
  await expect(page.getByTestId("rule-row")).toHaveCount(1);

  await page.getByRole("textbox", { name: "Request URL" }).fill(
    "https://assertions.test/data",
  );
  await page.getByRole("button", { name: /^send$/i }).click();
  await page.getByRole("tab", { name: /tests/i }).click();
  await expect(page.getByText(/tests · 1 passed · 0 failed/i)).toBeVisible();
  await capture(page, "tests-all-pass.png");

  await page.getByRole("button", { name: /add rule/i }).click();
  const secondRow = page.getByTestId("rule-row").nth(1);
  await choose(secondRow, "Rule kind", "JSONPath");
  await choose(secondRow, "Rule operator", "contains");
  await secondRow.getByRole("textbox", { name: "JSONPath" }).fill("$.roles");
  await secondRow
    .getByRole("textbox", { name: "Expected value" })
    .fill("owner");

  await page.getByRole("button", { name: /^send$/i }).click();
  await page.getByRole("tab", { name: /tests/i }).click();
  await expect(page.getByText(/tests · 1 passed · 1 failed/i)).toBeVisible();
  await expect(page.getByText(/got \["admin","editor"\]/i)).toBeVisible();
  await capture(page, "tests-mixed.png");

  await page
    .getByRole("textbox", { name: "Request URL" })
    .fill("https://assertions.test/failure");
  await page.getByRole("button", { name: /^send$/i }).click();
  await page.getByRole("tab", { name: /tests/i }).click();
  await expect(
    page.getByText(/not run — request did not complete/i),
  ).toBeVisible();
});

test("history replay restores isolated rules for each request reference", async ({
  page,
}) => {
  await page.route("https://assertions.test/first", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: '{"request":"first"}',
    }),
  );
  await page.route("https://assertions.test/second", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: '{"request":"second"}',
    }),
  );
  await page.goto("/");

  await page.getByRole("tab", { name: /tests/i }).click();
  await page.getByRole("button", { name: /add rule/i }).click();
  const expected = page.getByRole("textbox", { name: "Expected value" });
  await expected.fill("200");

  const requestUrl = page.getByRole("textbox", { name: "Request URL" });
  await requestUrl.fill("https://assertions.test/first");
  await page.getByRole("button", { name: /^send$/i }).click();
  const firstHistory = page
    .getByTestId("history-row")
    .filter({ hasText: "assertions.test/first" });
  await expect(firstHistory).toBeVisible();

  await page.getByRole("tab", { name: /tests/i }).click();
  await page.getByRole("textbox", { name: "Expected value" }).fill("201");
  await requestUrl.fill("https://assertions.test/second");
  await page.getByRole("button", { name: /^send$/i }).click();
  const secondHistory = page
    .getByTestId("history-row")
    .filter({ hasText: "assertions.test/second" });
  await expect(secondHistory).toBeVisible();

  await page.reload();
  await firstHistory.getByRole("button", { name: /replay get/i }).click();
  await page.getByRole("tab", { name: /tests/i }).click();
  await expect(
    page.getByRole("textbox", { name: "Expected value" }),
  ).toHaveValue("200");

  await secondHistory.getByRole("button", { name: /replay get/i }).click();
  await expect(
    page.getByRole("textbox", { name: "Expected value" }),
  ).toHaveValue("201");
});

test("saved requests restore their assertion rules after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /tests/i }).click();
  await page.getByRole("button", { name: /add rule/i }).click();
  const expected = page.getByRole("textbox", { name: "Expected value" });
  await expected.fill("200");
  await page
    .getByRole("textbox", { name: "Request URL" })
    .fill("https://saved.test/asserted");

  await page.getByRole("button", { name: /save request/i }).click();
  await page.getByRole("button", { name: /^save$/i }).click();
  const savedRequest = page.getByRole("button", {
    name: /open get get saved\.test\/asserted/i,
  });
  await expect(savedRequest).toBeVisible();

  await expected.fill("500");
  await page.reload();
  await savedRequest.click();
  await page.getByRole("tab", { name: /tests/i }).click();

  await expect(
    page.getByRole("textbox", { name: "Expected value" }),
  ).toHaveValue("200");
});
