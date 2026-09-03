import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const evidenceDir = process.env.EVIDENCE_DIR;

async function screenshot(page: Page, name: string) {
  if (!evidenceDir) return;
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, name), fullPage: true });
}

async function chooseTheme(page: Page, theme: "light" | "dark" | "system") {
  await page.getByRole("button", { name: /toggle theme/i }).click();
  await page
    .getByRole("menuitem", { name: new RegExp(`^${theme}$`, "i") })
    .click();
}

async function chooseMethod(page: Page, method: string) {
  const trigger = page.getByRole("combobox", { name: "HTTP method" });
  await trigger.click();
  await page.getByRole("option", { name: method, exact: true }).click();
  await expect(trigger).toContainText(method);
}

async function computedColor(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    context.fillStyle = getComputedStyle(element).color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  });
}

async function variableColor(page: Page, variable: string) {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    context.fillStyle = getComputedStyle(probe).color;
    context.fillRect(0, 0, 1, 1);
    const color = [...context.getImageData(0, 0, 1, 1).data];
    probe.remove();
    return color;
  }, variable);
}

test("system theme is correct at first paint, toggles, persists, and recolors Shiki", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      (
        window as typeof window & { __themeAtFirstFrame?: string }
      ).__themeAtFirstFrame = document.documentElement.classList.contains(
        "dark",
      )
        ? "dark"
        : "light";
    });
  });
  await page.route("https://api.test/theme", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"theme":"aware"}',
    }),
  );

  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __themeAtFirstFrame?: string })
            .__themeAtFirstFrame,
      ),
    )
    .toBe("dark");

  await page.getByLabel("Request URL").fill("https://api.test/theme");
  await page.getByRole("button", { name: /^send$/i }).click();
  const highlighted = page.locator("pre.shiki");
  await expect(highlighted).toBeVisible({ timeout: 15_000 });
  const shikiKeyword = highlighted
    .locator('span[style*="--shiki-token-keyword"]')
    .first();
  await expect(shikiKeyword).toBeVisible();
  const darkKeywordColor = await shikiKeyword.evaluate(
    (element) => getComputedStyle(element).color,
  );
  expect(await shikiKeyword.getAttribute("style")).toContain(
    "var(--shiki-token-keyword)",
  );
  await screenshot(page, "theme-dark.png");

  await chooseTheme(page, "light");
  await expect(html).toHaveClass(/light/);
  await expect
    .poll(() =>
      shikiKeyword.evaluate((element) => getComputedStyle(element).color),
    )
    .not.toBe(darkKeywordColor);
  expect(await page.evaluate(() => localStorage.getItem("verbose-theme"))).toBe(
    "light",
  );
  await screenshot(page, "theme-light.png");

  await page.reload();
  await expect(html).toHaveClass(/light/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveClass(/light/);

  await chooseTheme(page, "system");
  await expect(html).toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: /current system/i }),
  ).toContainText("System");
  expect(await page.evaluate(() => localStorage.getItem("verbose-theme"))).toBe(
    "system",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveClass(/light/);
});

test("a fresh browser follows a light OS preference and tracks live changes", async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();

  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/light/);
  expect(
    await page.evaluate(() => localStorage.getItem("verbose-theme")),
  ).toBeNull();

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await context.close();
});

test("missing OS theme APIs safely fall back to dark before first paint", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined,
    });
    requestAnimationFrame(() => {
      (
        window as typeof window & { __themeAtFirstFrame?: string }
      ).__themeAtFirstFrame = document.documentElement.classList.contains(
        "dark",
      )
        ? "dark"
        : "light";
    });
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __themeAtFirstFrame?: string })
            .__themeAtFirstFrame,
      ),
    )
    .toBe("dark");
  expect(errors).toEqual([]);
});

test("method and Shiki tokens drive computed colors in both themes", async ({
  page,
}) => {
  await page.route("https://api.test/tokens", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"color":42}',
    }),
  );
  await page.goto("/");

  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));

    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      await chooseMethod(page, method);
      const expected = await variableColor(
        page,
        `--method-${method.toLowerCase()}`,
      );
      await expect
        .poll(() => computedColor(page, "#request-method"))
        .toEqual(expected);
    }

    for (const method of ["HEAD", "OPTIONS"] as const) {
      await chooseMethod(page, method);
      const expected = await variableColor(page, "--muted-foreground");
      await expect
        .poll(() => computedColor(page, "#request-method"))
        .toEqual(expected);
    }
  }

  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--method-head",
      ),
    ),
  ).toBe("");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--method-options",
      ),
    ),
  ).toBe("");

  await page.getByLabel("Request URL").fill("https://api.test/tokens");
  await page.getByRole("button", { name: /^send$/i }).click();
  const constant = page
    .locator('pre.shiki span[style*="--shiki-token-constant"]')
    .first();
  await expect(constant).toBeVisible({ timeout: 15_000 });
  expect(
    await computedColor(
      page,
      'pre.shiki span[style*="--shiki-token-constant"]',
    ),
  ).toEqual(await variableColor(page, "--shiki-token-number"));
});

test("the provider hydrates without a theme mismatch", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (/hydration|did not match|server rendered html/i.test(error.message)) {
      hydrationErrors.push(error.message);
    }
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|did not match|server rendered html/i.test(message.text())
    ) {
      hydrationErrors.push(message.text());
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: /toggle theme/i }).waitFor();
  expect(hydrationErrors).toEqual([]);
});
