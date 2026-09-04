import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const evidenceDir = process.env.EVIDENCE_DIR;

async function screenshot(page: Page, name: string, fullPage = true) {
  if (!evidenceDir) return;
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, name), fullPage });
}

async function chooseTheme(page: Page, theme: "light" | "dark" | "system") {
  const toggle = page.getByRole("button", { name: /toggle theme/i });
  await expect(toggle).toHaveAccessibleName(/current (light|dark|system)/i);

  for (let attempts = 0; attempts < 3; attempts += 1) {
    const label = (await toggle.getAttribute("aria-label")) ?? "";
    if (new RegExp(`current ${theme}\\b`, "i").test(label)) return;

    await toggle.click();
    await expect.poll(() => toggle.getAttribute("aria-label")).not.toBe(label);
  }

  throw new Error(`Could not cycle to the ${theme} theme`);
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

async function contrastReport(page: Page) {
  return page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>(
      "[data-response-code-surface]",
    );
    const activeTab = document.querySelector<HTMLElement>(
      '[aria-label="Response body view"] [data-active]',
    );
    if (!surface || !activeTab) {
      throw new Error("Pretty response surface or active tab is missing");
    }

    const rgba = (value: string) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context unavailable");
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data] as [
        number,
        number,
        number,
        number,
      ];
    };
    const luminance = ([red, green, blue]: [
      number,
      number,
      number,
      number,
    ]) => {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return (
        0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
      );
    };
    const contrast = (foreground: string, background: string) => {
      const lighter = Math.max(
        luminance(rgba(foreground)),
        luminance(rgba(background)),
      );
      const darker = Math.min(
        luminance(rgba(foreground)),
        luminance(rgba(background)),
      );
      return (lighter + 0.05) / (darker + 0.05);
    };
    const opaqueBackground = (element: HTMLElement) => {
      let current: HTMLElement | null = element;
      while (current) {
        const value = getComputedStyle(current).backgroundColor;
        if (rgba(value)[3] === 255) return value;
        current = current.parentElement;
      }
      return "rgb(255 255 255)";
    };

    const surfaceBackground = getComputedStyle(surface).backgroundColor;
    const tokenRatios = [
      ...surface.querySelectorAll<HTMLElement>(
        'pre.shiki span[style*="color:"]',
      ),
    ].map((token) =>
      contrast(getComputedStyle(token).color, surfaceBackground),
    );

    return {
      activeTab: contrast(
        getComputedStyle(activeTab).color,
        opaqueBackground(activeTab),
      ),
      minimumToken: Math.min(...tokenRatios),
      tokenCount: tokenRatios.length,
    };
  });
}

test("the app header and saved rail stick while the icon-only theme control cycles on tap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const header = page.getByRole("banner", { name: "Verbose" });
  const headerBox = await header.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox?.x).toBe(0);
  expect(headerBox?.width).toBe(1280);
  expect(
    await header.evaluate((element) => getComputedStyle(element).position),
  ).toBe("sticky");
  expect(
    await header.evaluate((element) => getComputedStyle(element).top),
  ).toBe("0px");
  expect(
    await header.evaluate((element) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context unavailable");
      context.fillStyle = getComputedStyle(element).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3];
    }),
  ).toBe(255);

  const themeToggle = page.getByRole("button", { name: /toggle theme/i });
  await expect(themeToggle).toHaveAccessibleName(/current system.*next light/i);
  await expect(themeToggle.locator("svg")).toHaveClass(/lucide-monitor/);
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(themeToggle).not.toContainText(/system|light|dark/i);
  await themeToggle.click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(themeToggle).toHaveAccessibleName(/current light.*next dark/i);
  await expect(themeToggle.locator("svg")).toHaveClass(/lucide-sun/);
  expect(await page.evaluate(() => localStorage.getItem("verbose-theme"))).toBe(
    "light",
  );
  await themeToggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(themeToggle).toHaveAccessibleName(/current dark.*next system/i);
  await expect(themeToggle.locator("svg")).toHaveClass(/lucide-moon/);
  expect(await page.evaluate(() => localStorage.getItem("verbose-theme"))).toBe(
    "dark",
  );
  await themeToggle.click();
  await expect(themeToggle).toHaveAccessibleName(/current system.*next light/i);
  await expect(themeToggle.locator("svg")).toHaveClass(/lucide-monitor/);
  await expect(page.locator("html")).toHaveClass(/light/);
  expect(await page.evaluate(() => localStorage.getItem("verbose-theme"))).toBe(
    "system",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(themeToggle).toHaveAccessibleName(/current system.*next light/i);
  await expect(themeToggle.locator("svg")).toHaveClass(/lucide-monitor/);
  expect(await page.evaluate(() => localStorage.getItem("verbose-theme"))).toBe(
    "system",
  );
  await expect(page.getByRole("menu")).toHaveCount(0);

  await themeToggle.click();
  await expect(page.locator("html")).toHaveClass(/light/);

  for (let index = 1; index <= 14; index += 1) {
    await page
      .getByLabel("Request URL")
      .fill(`https://saved.test/request-${index}`);
    await page.getByRole("button", { name: "Save request" }).click();
    const dialog = page.getByRole("dialog", { name: "Save request" });
    await dialog
      .getByRole("textbox", { name: "Request name" })
      .fill(`Saved request ${index}`);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  const savedSidebar = page.getByRole("region", { name: "Saved requests" });
  expect(
    await savedSidebar.evaluate(
      (element) => getComputedStyle(element).position,
    ),
  ).toBe("sticky");
  const sidebarTop = Number.parseFloat(
    await savedSidebar.evaluate((element) => getComputedStyle(element).top),
  );
  const currentHeaderBox = await header.boundingBox();
  expect(currentHeaderBox).not.toBeNull();
  const headerBottom =
    (currentHeaderBox?.y ?? 0) + (currentHeaderBox?.height ?? 0);
  expect(sidebarTop).toBeGreaterThanOrEqual(headerBottom);

  const sidebarOverflow = await savedSidebar.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }));
  expect(sidebarOverflow.overflowY).toBe("auto");
  expect(sidebarOverflow.scrollHeight).toBeGreaterThan(
    sidebarOverflow.clientHeight,
  );
  expect(sidebarOverflow.clientHeight).toBeLessThanOrEqual(720 - sidebarTop);

  const pageScrollBeforeRail = await page.evaluate(() => window.scrollY);
  await savedSidebar.evaluate((element) => element.scrollTo(0, 120));
  await expect
    .poll(() => savedSidebar.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBeforeRail);

  await page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  await expect
    .poll(async () => (await savedSidebar.boundingBox())?.y)
    .toBeCloseTo(sidebarTop, 0);
  await screenshot(page, "sticky-chrome-light.png", false);

  await page.setViewportSize({ width: 900, height: 720 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await savedSidebar.evaluate(
      (element) => getComputedStyle(element).position,
    ),
  ).toBe("static");
  const narrowSidebarBox = await savedSidebar.boundingBox();
  const workbenchBox = await page.locator("#request-form").boundingBox();
  expect(narrowSidebarBox).not.toBeNull();
  expect(workbenchBox).not.toBeNull();
  expect(narrowSidebarBox?.y).toBeLessThan(workbenchBox?.y ?? 0);
});

test("the app header, Geist typography, warm canvas, and Pretty contrast hold in both themes", async ({
  page,
}) => {
  await page.route("https://api.test/contrast", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <style>body { color: red }</style>\n  </head>\n  <body>\n    <h1>Hello</h1>\n    <!-- note -->\n  </body>\n</html>',
    }),
  );
  await page.route("https://api.test/contrast.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        contrast: true,
        count: 42,
        nested: { value: null },
      }),
    }),
  );
  await page.goto("/");

  const responses = [
    { expected: "Hello", url: "https://api.test/contrast" },
    { expected: "contrast", url: "https://api.test/contrast.json" },
  ];

  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await expect(page.getByRole("banner", { name: "Verbose" })).toBeVisible();

    const typography = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      heading: getComputedStyle(document.querySelector("h1")!).fontFamily,
    }));
    expect(typography.body).toMatch(/Geist/i);
    expect(typography.heading).toMatch(/Geist/i);
    expect(typography.body).not.toMatch(/Times New Roman|serif/i);
    expect(typography.heading).not.toMatch(/Times New Roman|serif/i);

    if (theme === "light") {
      const warmBackground = await variableColor(page, "--background");
      expect(warmBackground[0]).toBeGreaterThan(warmBackground[2]);
      await screenshot(page, "interface-light.png");
    }

    for (const response of responses) {
      await page.getByLabel("Request URL").fill(response.url);
      await page.getByRole("button", { name: /^send$/i }).click();
      const highlighted = page.locator("pre.shiki");
      await expect(highlighted).toContainText(response.expected, {
        timeout: 15_000,
      });

      const report = await contrastReport(page);
      expect(report.tokenCount).toBeGreaterThan(0);
      expect(report.minimumToken).toBeGreaterThanOrEqual(4.5);
      expect(report.activeTab).toBeGreaterThanOrEqual(4.5);

      if (theme === "light" && response.url.endsWith("/contrast")) {
        await screenshot(page, "pretty-light.png");
      }
    }
  }
});

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
  ).not.toContainText(/system|light|dark/i);
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
