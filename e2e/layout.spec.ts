import { test, expect, visibleMain, type Page } from "./fixtures";

// Elements that stick out past the right edge of the window without being
// inside something that scrolls. body has overflow-x: clip, so such content
// would be cut off and unreachable rather than causing a scrollbar.
async function clippedElements(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrolls = (el: Element | null): boolean => {
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        const { overflowX } = getComputedStyle(node);
        if (overflowX === "auto" || overflowX === "scroll") return true;
      }
      return false;
    };
    return [...document.querySelectorAll("body *")]
      .filter((el) => el.checkVisibility() && el.getBoundingClientRect().right > width + 1 && !scrolls(el.parentElement))
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80));
  });
}

const sideOutline = (page: Page) => page.locator("aside").getByRole("navigation", { name: "On this page" });
const outlineBox = (page: Page) => visibleMain(page).locator("details").filter({ hasText: "On this page" }).first();

test.describe("responsive layout", () => {
  for (const width of [375, 768, 1024, 1280, 1440]) {
    test(`${width}px: nothing cut off, one main and h1, the right outline`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", "/kana/1", "/kanji/2", "/practice/1"]) {
        await page.goto(path);
        expect(await clippedElements(page), `${path} at ${width}px`).toEqual([]);
        await expect(visibleMain(page)).toHaveCount(1);
        await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveCount(1);
        if (path !== "/") {
          await expect(sideOutline(page)).toBeVisible({ visible: width >= 1280 });
          await expect(outlineBox(page)).toBeVisible({ visible: width < 1280 });
        }
      }
    });
  }

  test("the outline moves beside the text exactly at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1279, height: 900 });
    await page.goto("/chapters/5");
    await expect(sideOutline(page)).toBeHidden();
    await expect(outlineBox(page)).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(sideOutline(page)).toBeVisible();
    await expect(outlineBox(page)).toBeHidden();
  });

  test("sticky outline: fits the window, scrolls on its own, stays below the header", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/kana/1");
    const nav = sideOutline(page);
    for (const summary of await nav.locator("summary").all()) await summary.click();
    const box = await nav.evaluate((el) => ({
      scrollable: el.scrollHeight > el.clientHeight,
      bottom: el.getBoundingClientRect().bottom,
    }));
    expect(box.scrollable).toBe(true);
    expect(box.bottom).toBeLessThanOrEqual(900);

    const headerBottom = await page.locator("body > header").evaluate((el) => el.getBoundingClientRect().bottom);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await expect.poll(() => nav.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(Math.round(headerBottom) + 24);

    // its own scrolling reaches the last link
    const last = nav.getByRole("link").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
  });

  test("phone: wide tables scroll inside their frame, long titles wrap", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/kana/1");
    const wide = visibleMain(page).locator(".lesson .tw").first();
    const sizes = await wide.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    await wide.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect.poll(() => wide.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

    // a long title, and long exam questions in the tables
    await page.goto("/practice/1");
    const h1 = visibleMain(page).getByRole("heading", { level: 1 });
    expect(await h1.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await clippedElements(page)).toEqual([]);
  });
});

test.describe("keyboard and navigation", () => {
  test("skip link moves focus to the content", async ({ page }) => {
    await page.goto("/practice/1");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("#content")).toBeFocused();
  });

  test("phone menu: Escape closes it and returns focus; choosing a link closes it", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/chapters/2");
    const button = page.getByRole("button", { name: "Open menu" });
    const menu = page.locator("#mobile-nav");
    await button.click();
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();

    await button.click();
    await menu.getByRole("link", { name: "Kanji" }).click();
    await expect(page).toHaveURL("/#kanji");
    await expect(menu).toBeHidden();
  });

  test("outline groups open with Enter and Space, with a visible focus ring", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/practice/1");
    const summary = sideOutline(page).locator("summary").first();
    await summary.focus();
    expect(await summary.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    const details = sideOutline(page).locator("details").first();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(details).not.toHaveAttribute("open", "");
  });

  test("controls have accessible names", async ({ page }) => {
    for (const path of ["/", "/kana/1"]) {
      await page.goto(path);
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll("button, input, select, a[href], summary")]
          .filter((el) => el.checkVisibility())
          .filter((el) => {
            const label = el.getAttribute("aria-label") || el.textContent?.trim();
            return !label;
          })
          .map((el) => el.outerHTML.slice(0, 80))
      );
      expect(unnamed, path).toEqual([]);
    }
  });
});
