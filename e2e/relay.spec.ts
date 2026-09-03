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
        bodyText: "relayed",
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
