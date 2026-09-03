import { expect, test } from "@playwright/test";

test("history logs, reloads, replays, searches, and clears", async ({ page }) => {
  let requestCount = 0;
  await page.route("https://history.test/**", async (route) => {
    requestCount += 1;
    await route.fulfill({
      body: JSON.stringify({ persisted: true }),
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      status: 201,
    });
  });

  await page.goto("/");
  const urlInput = page.getByRole("textbox", { name: "Request URL" });
  await urlInput.fill("https://history.test/persisted?item=1");
  await page.getByRole("button", { name: "Send" }).click();

  const row = page
    .getByTestId("history-row")
    .filter({ hasText: "history.test/persisted?item=1" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("201");
  await page.screenshot({
    fullPage: true,
    path: ".vegastack/.tmp/8-history/evidence/history-populated.png",
  });

  await page.reload();
  await expect(row).toBeVisible();

  await urlInput.fill("https://history.test/not-sent");
  await row.getByRole("button", { name: /replay get/i }).click();
  await expect(urlInput).toHaveValue("https://history.test/persisted?item=1");
  expect(requestCount).toBe(1);

  await page.getByRole("searchbox").fill("zzz-no-such-request");
  await expect(page.getByText("No matching requests")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: ".vegastack/.tmp/8-history/evidence/history-no-match.png",
  });

  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Clear history" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(
    page.getByText("Requests will appear here after sending."),
  ).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: ".vegastack/.tmp/8-history/evidence/history-cleared.png",
  });
});

test("history logs non-2xx and network failures without persisting query auth", async ({
  page,
}) => {
  let authenticatedWireUrl = "";
  await page.route("https://history.test/non-2xx", (route) =>
    route.fulfill({ status: 429, body: "slow down" }),
  );
  await page.route("https://history.test/network-fail", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 60));
    await route.abort("failed");
  });
  await page.route("https://history.test/auth**", async (route) => {
    authenticatedWireUrl = route.request().url();
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/api/relay", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: "upstream-unreachable",
        message: "simulated network failure",
      }),
    }),
  );

  await page.goto("/");
  const url = page.getByRole("textbox", { name: "Request URL" });

  await url.fill("https://history.test/non-2xx");
  await page.getByRole("button", { name: "Send" }).click();
  const non2xxRow = page
    .getByTestId("history-row")
    .filter({ hasText: "history.test/non-2xx" });
  await expect(non2xxRow).toContainText("429");

  await url.fill("https://history.test/network-fail");
  await page.getByRole("button", { name: "Send" }).click();
  const failureRow = page
    .getByTestId("history-row")
    .filter({ hasText: "history.test/network-fail" });
  await expect(failureRow).toContainText("—");
  await expect
    .poll(async () => {
      const match = (await failureRow.textContent())?.match(/(\d+) ms/);
      return Number(match?.[1] ?? 0);
    })
    .toBeGreaterThan(0);

  await url.fill("https://history.test/auth");
  await page.getByRole("combobox", { name: "Auth preset" }).click();
  await page.getByRole("option", { name: "API key" }).click();
  await page.getByLabel("API key name").fill("api_key");
  await page.getByLabel("API key value").fill("history-secret");
  await page.getByRole("tab", { name: "Query param" }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => authenticatedWireUrl).toContain(
    "api_key=history-secret",
  );

  const authRow = page
    .getByTestId("history-row")
    .filter({ hasText: "history.test/auth" });
  await expect(authRow).toContainText("https://history.test/auth");
  await expect(authRow).not.toContainText("history-secret");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export history as JSON" }).click();
  const stream = await (await downloadPromise).createReadStream();
  let exported = "";
  for await (const chunk of stream) exported += chunk.toString();
  expect(exported).not.toContain("history-secret");
  expect(exported).not.toContain("api_key");
});
