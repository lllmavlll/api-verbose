import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { gzipSync } from "node:zlib";

const evidenceDir = process.env.EVIDENCE_DIR;

async function screenshot(page: Page, name: string) {
  if (!evidenceDir) {
    return;
  }

  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    path: path.join(evidenceDir, name),
    fullPage: true,
  });
}

async function send(page: Page, url: string) {
  await page.getByLabel("Request URL").fill(url);
  await page.getByRole("button", { name: /^send$/i }).click();
}

test("JSON renders highlighted in both themes and toggles to byte-exact Raw", async ({
  page,
}) => {
  const body = '{"role":"admin","n":1}';
  let requestCount = 0;
  await page.route("https://api.test/echo", (route) => {
    requestCount += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body });
  });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
  });

  await send(page, "https://api.test/echo");
  const highlighted = page.locator("pre.shiki");
  await expect(highlighted).toBeVisible({ timeout: 15_000 });
  const darkStyle = await highlighted.getAttribute("style");
  await screenshot(page, "render-pretty-dark.png");

  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
  });
  await expect
    .poll(() => highlighted.getAttribute("style"))
    .not.toBe(darkStyle);
  await screenshot(page, "render-pretty-light.png");

  const responseTabs = page.getByRole("tablist", {
    name: "Response body view",
  });
  const rawTab = responseTabs.getByRole("tab", { name: /^raw$/i });
  await rawTab.click();
  await expect(rawTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await page.waitForTimeout(200);
  await screenshot(page, "render-raw.png");
  await responseTabs.getByRole("tab", { name: /^pretty$/i }).click();
  expect(requestCount).toBe(1);

  const previewHelp = page.getByLabel("Why Preview is unavailable");
  await previewHelp.hover();
  await expect(
    page.getByText("Preview is available for HTML and images."),
  ).toBeVisible();
});

test("HTML Preview is sandboxed, script-free, and makes no outbound requests", async ({
  page,
}) => {
  let trackerRequests = 0;
  const topLevelUrl = "http://127.0.0.1:3102/";
  await page.route("https://tracker.test/**", (route) => {
    trackerRequests += 1;
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/preview-relative", (route) => {
    trackerRequests += 1;
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("https://api.test/html", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: '<h1>Hello</h1><a href="https://tracker.test/click">Outbound link</a><a href="/preview-relative">Relative link</a><img alt="Safe inline preview" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2240%22%3E%3Crect width=%2280%22 height=%2240%22 rx=%228%22 fill=%22%2316a34a%22/%3E%3C/svg%3E"><img hidden src="https://tracker.test/pixel"><script>window.__previewScriptRan=true;fetch("https://tracker.test/script")</script>',
    }),
  );
  await page.goto("/");

  await send(page, "https://api.test/html");
  await page.getByRole("tab", { name: /^preview$/i }).click();
  const frameElement = page.locator("iframe");
  await expect(frameElement).toBeVisible();
  expect((await frameElement.getAttribute("sandbox")) ?? "").not.toContain(
    "allow-scripts",
  );
  await expect(frameElement).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(frameElement).toHaveAttribute("csp", /default-src 'none'/);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  expect(frame).toBeDefined();
  expect(await frame?.evaluate(() => (window as typeof window & { __previewScriptRan?: boolean }).__previewScriptRan)).toBeUndefined();
  for (const name of ["Outbound link", "Relative link"]) {
    const box = await frame?.getByRole("link", { name }).boundingBox();
    expect(box).toBeDefined();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  }
  await page.waitForTimeout(100);
  expect(trackerRequests).toBe(0);
  expect(page.url()).toBe(topLevelUrl);
  await screenshot(page, "render-preview-html.png");
});

test("textual and binary image responses load from local blob URLs", async ({ page }) => {
  await page.route("https://api.test/image.svg", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml; charset=utf-8",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><text y="15">é</text></svg>',
    }),
  );
  await page.route("https://api.test/image.png", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/");

  await send(page, "https://api.test/image.svg");
  await page.getByRole("tab", { name: /^preview$/i }).click();
  const image = page.getByAltText("Response preview");
  await expect(image).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBe(40);

  await send(page, "https://api.test/image.png");
  await page.getByRole("tab", { name: /^preview$/i }).click();
  await expect
    .poll(() =>
      page
        .getByAltText("Response preview")
        .evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBe(1);
});

test("a real redirected fetch shows its start and final URL", async ({ page }) => {
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (request.url === "/start") {
      response.writeHead(302, { location: "/final" });
      response.end();
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"redirected":true}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const startUrl = `http://127.0.0.1:${port}/start`;
  const finalUrl = `http://127.0.0.1:${port}/final`;

  try {
    await page.goto("/");
    await send(page, startUrl);
    await expect(page.getByText("Redirect chain")).toBeVisible();
    await expect(page.getByText(startUrl)).toBeVisible();
    await expect(page.getByText(finalUrl)).toBeVisible();
    await expect(page.getByText("200 OK")).toBeVisible();
    await expect(page.locator("pre.shiki")).toBeVisible({ timeout: 15_000 });
    await screenshot(page, "render-redirect-chain.png");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("an over-cap response falls back to Raw without starting Shiki", async ({
  page,
}) => {
  await page.route("https://api.test/large", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: `{"value":"${"x".repeat(1_000_000)}"}`,
    }),
  );
  await page.goto("/");

  await send(page, "https://api.test/large");
  await expect(
    page.getByText(/large response.*highlighting off.*showing raw/i),
  ).toBeVisible();
  await expect(page.locator("pre.shiki")).toHaveCount(0);
});

test("a compressed response is capped by its decoded body size", async ({ page }) => {
  const decoded = `{"value":"${"x".repeat(1_000_000)}"}`;
  const compressed = gzipSync(decoded);
  const server = createServer((_request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Content-Encoding", "gzip");
    response.setHeader("Content-Length", String(compressed.byteLength));
    response.setHeader("Content-Type", "application/json");
    response.end(compressed);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    await page.goto("/");
    await send(page, `http://127.0.0.1:${port}/compressed`);
    await expect(
      page.getByText(/large response.*highlighting off.*showing raw/i),
    ).toBeVisible();
    await expect(page.locator("pre.shiki")).toHaveCount(0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
