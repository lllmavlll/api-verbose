import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function capture(page: Page, name: string) {
  if (process.env.EVIDENCE_DIR) {
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(process.env.EVIDENCE_DIR, name),
      caret: "initial",
      fullPage: true,
    });
  }
}

test("a curl import repopulates the whole request and reports ignored flags", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /import curl/i }).click();
  await capture(page, "curl-import-idle.png");
  await page
    .getByRole("textbox", { name: /curl command/i })
    .fill(
      `curl -X POST 'https://api.test/items?q=one' -H 'Content-Type: application/json' -H 'X-Env: dev' -u 'alice:s3cret' -d '{"hello":"world"}' --compressed`,
    );
  await page.getByRole("button", { name: /^import$/i }).click();

  await expect(page.getByLabel("Request URL")).toHaveValue(
    "https://api.test/items?q=one",
  );
  await expect(page.getByRole("combobox", { name: "HTTP method" })).toContainText(
    "POST",
  );
  const headers = page.getByRole("region", { name: "Headers" });
  await expect(headers.getByPlaceholder("Key").nth(0)).toHaveValue(
    "Content-Type",
  );
  await expect(headers.getByPlaceholder("Key").nth(1)).toHaveValue("X-Env");
  await expect(page.getByRole("combobox", { name: "Auth preset" })).toContainText(
    "Basic",
  );
  await expect(page.getByLabel("Username")).toHaveValue("alice");
  await expect(page.locator(".cm-content")).toContainText('"hello"');
  const ignored = page.locator('[data-slot="alert"]');
  await expect(ignored).toContainText("Ignored 1 flag");
  await expect(ignored).toContainText("--compressed");
  await capture(page, "curl-import-ignored.png");
});

test("an invalid curl import leaves the current request unchanged", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Request URL").fill("https://keep.test/x");
  await page.getByRole("button", { name: /import curl/i }).click();
  await page
    .getByRole("textbox", { name: /curl command/i })
    .fill("curl https://api.test/x -H 'oops");
  await page.getByRole("button", { name: /^import$/i }).click();

  await expect(page.getByText(/unterminated quote/i)).toBeVisible();
  await expect(page.getByLabel("Request URL")).toHaveValue(
    "https://keep.test/x",
  );
});

test("copy-as offers and copies curl, fetch, and Python snippets", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: /import curl/i }).click();
  await page
    .getByRole("textbox", { name: /curl command/i })
    .fill(
      `curl -X POST 'https://api.test/x?q=one' -H 'Content-Type: application/json' -H 'X-Env: dev' -u 'alice:s3cret' -d '{"hello":"world"}'`,
    );
  await page.getByRole("button", { name: /^import$/i }).click();

  const expected: [string, RegExp[]][] = [
    [
      "curl",
      [
        /^curl -X POST/,
        /https:\/\/api\.test\/x\?q=one/,
        /Content-Type: application\/json/,
        /X-Env: dev/,
        /alice:s3cret/,
        /"hello":\s*"world"/,
      ],
    ],
    [
      "fetch (JS)",
      [
        /^fetch\('/,
        /https:\/\/api\.test\/x\?q=one/,
        /method: 'POST'/,
        /'X-Env': 'dev'/,
        /btoa\('alice:s3cret'\)/,
        /"hello":\s*"world"/,
      ],
    ],
    [
      "Python (requests)",
      [
        /import requests/,
        /requests\.request\('POST'/,
        /https:\/\/api\.test\/x\?q=one/,
        /'X-Env': 'dev'/,
        /auth=\('alice', 's3cret'\)/,
        /data='\{"hello":"world"\}'/,
      ],
    ],
  ];

  await page.getByRole("button", { name: /copy as/i }).click();
  for (const [label] of expected) {
    await expect(page.getByRole("menuitem", { name: label })).toBeVisible();
  }
  await capture(page, "curl-copy-menu.png");
  await page.keyboard.press("Escape");

  for (const [label, patterns] of expected) {
    await page.getByRole("button", { name: /copy as/i }).click();
    await page.getByRole("menuitem", { name: label }).click();
    await expect(page.getByRole("status")).toContainText(`Copied as ${label}`);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    for (const pattern of patterns) expect(copied).toMatch(pattern);
  }
});

test("copy-as menu is keyboard operable", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByLabel("Request URL").fill("https://api.test/x");

  const trigger = page.getByRole("button", { name: /copy as/i });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "curl" })).toHaveAttribute(
    "data-highlighted",
    "",
  );
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toContainText("Copied as curl");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/^curl -X GET/);
});

test("the send shortcut is inert while editing curl import text", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://api.test/mutate", async (route) => {
    requests += 1;
    await route.fulfill({ body: "ok", status: 200 });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /import curl/i }).click();
  await page
    .getByRole("textbox", { name: /curl command/i })
    .fill(
      "curl -X POST https://api.test/mutate -u alice:secret -d mutate=true",
    );
  await page.getByRole("button", { name: /^import$/i }).click();

  await page.getByRole("button", { name: /import curl/i }).click();
  await page.getByRole("textbox", { name: /curl command/i }).focus();
  await page.keyboard.press("Meta+Enter");
  await page.waitForTimeout(200);

  expect(requests).toBe(0);
  await expect(
    page.getByRole("dialog", { name: /import curl/i }),
  ).toBeVisible();
});
