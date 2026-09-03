import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function capture(page: Page, name: string) {
  if (process.env.EVIDENCE_DIR) {
    await page.screenshot({
      path: path.join(process.env.EVIDENCE_DIR, name),
      caret: "initial",
      fullPage: true,
    });
  }
}

async function chooseMethod(page: Page, method: string) {
  await page.getByRole("combobox", { name: "HTTP method" }).click();
  await page.getByRole("option", { name: method, exact: true }).click();
}

test("body editors show JSON, form, and method-gated states", async ({ page }) => {
  await page.goto("/");
  await chooseMethod(page, "POST");

  await page.getByRole("tab", { name: "JSON" }).click();
  await page.locator(".cm-content").click();
  await page.keyboard.insertText('{"hello":"world"}');
  await expect(page.locator(".cm-content")).toContainText('"hello"');
  await capture(page, "body-json.png");

  await page.getByRole("tab", { name: "Form" }).click();
  await page.getByRole("button", { name: "Add field" }).click();
  const form = page.getByRole("region", { name: "Form body" });
  await form.getByPlaceholder("Key").fill("name");
  await form.getByPlaceholder("Value").fill("ada");
  await capture(page, "body-form.png");

  await page.getByRole("tab", { name: "Raw" }).click();
  await chooseMethod(page, "GET");
  await expect(page.getByText(/body not sent for GET/i)).toBeVisible();
  await capture(page, "body-disallowed.png");
});

test("JSON text is sent verbatim with an automatic content type", async ({
  page,
}) => {
  let requestCount = 0;
  let requestBody: string | null = null;
  let requestContentType: string | undefined;
  await page.route("https://api.test/json", async (route) => {
    requestCount += 1;
    requestBody = route.request().postData();
    requestContentType = route.request().headers()["content-type"];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: requestBody ?? "null",
    });
  });

  await page.goto("/");
  await chooseMethod(page, "POST");
  await page.getByLabel("Request URL").fill("https://api.test/json");
  await page.getByRole("tab", { name: "JSON" }).click();
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.insertText('{"ok":true}');
  await editor.press("Meta+Enter");

  await expect(page.getByText(/"ok": true/)).toBeVisible();
  expect(requestBody).toBe('{"ok":true}');
  expect(requestContentType).toBe("application/json");
  expect(requestCount).toBe(1);
});

test("whitespace-only JSON is omitted without a misleading invalid hint", async ({
  page,
}) => {
  let requestBody: string | null = "not-sent";
  let requestContentType: string | undefined;
  await page.route("https://api.test/empty", async (route) => {
    requestBody = route.request().postData();
    requestContentType = route.request().headers()["content-type"];
    await route.fulfill({ status: 200, body: "accepted" });
  });

  await page.goto("/");
  await chooseMethod(page, "POST");
  await page.getByLabel("Request URL").fill("https://api.test/empty");
  await page.getByRole("tab", { name: "JSON" }).click();
  await page.locator(".cm-content").click();
  await page.keyboard.insertText("   ");

  await expect(page.getByText(/invalid JSON/i)).toHaveCount(0);
  await page.getByRole("button", { name: /^send$/i }).click();
  await expect(page.getByText("accepted")).toBeVisible();
  expect(requestBody).toBeNull();
  expect(requestContentType).toBeUndefined();
});

test("an idempotent body crosses the real relay-client boundary unchanged", async ({
  page,
}) => {
  let relayPayload: unknown;
  await page.route("https://api.test/relay", (route) => route.abort("failed"));
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
        bodyBase64: "YWNjZXB0ZWQ=",
        sizeBytes: 8,
      }),
    });
  });

  await page.goto("/");
  await chooseMethod(page, "PUT");
  await page.getByLabel("Request URL").fill("https://api.test/relay");
  await page.getByRole("tab", { name: "JSON" }).click();
  await page.locator(".cm-content").click();
  await page.keyboard.insertText('{"relay":true}');
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByText(/via relay/i)).toBeVisible();
  await expect.poll(() => relayPayload).toEqual({
    method: "PUT",
    url: "https://api.test/relay",
    headers: [["Content-Type", "application/json"]],
    body: '{"relay":true}',
  });
});

test("malformed JSON remains sendable and explicit content type wins", async ({
  page,
}) => {
  let requestBody: string | null = null;
  let requestContentType: string | undefined;
  await page.route("https://api.test/malformed", async (route) => {
    requestBody = route.request().postData();
    requestContentType = route.request().headers()["content-type"];
    await route.fulfill({ status: 200, body: "accepted" });
  });

  await page.goto("/");
  await chooseMethod(page, "POST");
  await page.getByLabel("Request URL").fill("https://api.test/malformed");
  const headers = page.getByRole("region", { name: "Headers" });
  await headers.getByPlaceholder("Key").first().fill("Content-Type");
  await headers
    .getByPlaceholder("Value")
    .first()
    .fill("application/vnd.test+json");
  await page.getByRole("tab", { name: "JSON" }).click();
  await page.locator(".cm-content").click();
  await page.keyboard.insertText("{bad");

  await expect(page.getByText(/invalid JSON/i)).toBeVisible();
  await page.getByRole("button", { name: /^send$/i }).click();
  await expect(page.getByText("accepted")).toBeVisible();
  expect(requestBody).toBe("{bad");
  expect(requestContentType).toBe("application/vnd.test+json");
});

test("form fields serialize in order with duplicate keys", async ({ page }) => {
  let requestBody: string | null = null;
  let requestContentType: string | undefined;
  await page.route("https://api.test/form", async (route) => {
    requestBody = route.request().postData();
    requestContentType = route.request().headers()["content-type"];
    await route.fulfill({ status: 200, body: "accepted" });
  });

  await page.goto("/");
  await chooseMethod(page, "POST");
  await page.getByLabel("Request URL").fill("https://api.test/form");
  await page.getByRole("tab", { name: "Form" }).click();
  const form = page.getByRole("region", { name: "Form body" });
  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByRole("button", { name: "Add field" }).click();
  await form.getByPlaceholder("Key").nth(0).fill("name");
  await form.getByPlaceholder("Value").nth(0).fill("ada lovelace");
  await form.getByPlaceholder("Key").nth(1).fill("name");
  await form.getByPlaceholder("Value").nth(1).fill("countess");
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByText("accepted")).toBeVisible();
  expect(requestBody).toBe("name=ada+lovelace&name=countess");
  expect(requestContentType).toBe("application/x-www-form-urlencoded");
});
