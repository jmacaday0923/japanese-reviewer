import { test, expect, search, visibleMain } from "./fixtures";

const key = "japanese-reviewer:reading-visibility";
const aid = (page: import("@playwright/test").Page, kind: string) => visibleMain(page).getByRole("checkbox", { name: "Show " + kind, exact: true });
const hints = (page: import("@playwright/test").Page, kind: string) => visibleMain(page).locator('[data-reading-hint="' + kind + '"]');
const content = (hint: import("@playwright/test").Locator) => hint.locator(":scope > span[id]");

test.use({ viewport: { width: 1440, height: 900 } });

test("three independent toggles; reveal one hint; re-hide; refresh persistence", async ({ page }) => {
  await page.goto("/chapters/1");
  await expect(aid(page, "romaji")).toBeChecked();
  const romaji = hints(page, "romaji");
  const english = hints(page, "english");
  await expect(content(romaji.first())).toBeVisible();
  await aid(page, "romaji").uncheck();
  await expect(content(romaji.first())).toBeHidden();
  await expect(content(english.first())).toBeVisible();
  await romaji.first().getByRole("button").click();
  await expect(content(romaji.first())).toBeVisible();
  await expect(content(romaji.nth(1))).toBeHidden();
  await expect(aid(page, "romaji")).not.toBeChecked();
  await visibleMain(page).getByRole("button", { name: "Hide revealed hints" }).click();
  await expect(content(romaji.first())).toBeHidden();
  await aid(page, "english").uncheck();
  await expect(content(english.first())).toBeHidden();
  await expect(aid(page, "furigana")).toBeChecked();
  await page.reload();
  await expect(aid(page, "romaji")).not.toBeChecked();
  await expect(aid(page, "english")).not.toBeChecked();
  await expect(content(romaji.first())).toBeHidden();
  await expect(content(english.first())).toBeHidden();
  await expect(page).toHaveURL("/chapters/1");
});

test("furigana hides readings, preserves kanji, and reveals only one word", async ({ page }) => {
  await page.goto("/kanji/1");
  const words = visibleMain(page).locator("[data-reading-word]");
  const word = words.first();
  await expect(word.locator("rt")).toBeVisible();
  const text = await word.locator("ruby").evaluate((el) => el.firstChild?.textContent);
  await aid(page, "furigana").uncheck();
  await expect(word.locator("rt")).toBeHidden();
  await expect(word.locator("ruby")).toBeVisible();
  expect(await word.locator("ruby").evaluate((el) => el.firstChild?.textContent)).toBe(text);
  await word.getByRole("button").click();
  await expect(word.locator("rt")).toBeVisible();
  await expect(words.nth(1).locator("rt")).toBeHidden();
  await expect(aid(page, "romaji")).toBeChecked();
  await expect(aid(page, "english")).toBeChecked();
});

test("search uses the same preferences; revealing does not follow the result link", async ({ page }) => {
  await page.goto("/chapters/1");
  await aid(page, "romaji").uncheck();
  await aid(page, "english").uncheck();
  await page.goto("/?q=gakkou&category=vocab");
  const s = search(page);
  await expect(s.results.first()).toBeVisible();
  await expect(aid(page, "romaji")).not.toBeChecked();
  const first = hints(page, "english").first();
  await expect(content(first)).toBeHidden();
  await first.getByRole("button").click();
  await expect(content(first)).toBeVisible();
  await expect(page).toHaveURL("/?q=gakkou&category=vocab");
  await expect(s.results.first().locator("a button")).toHaveCount(0);
  const link = s.results.first().getByRole("link");
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(href!);
  await expect(aid(page, "english")).not.toBeChecked();
});

test("keyboard reveal controls have expanded state and hidden hints leave the accessible tree", async ({ page }) => {
  await page.goto("/chapters/1");
  await aid(page, "english").uncheck();
  const hint = hints(page, "english").first();
  const button = hint.getByRole("button");
  await expect(content(hint)).toHaveAttribute("aria-hidden", "true");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(content(hint)).toHaveAttribute("aria-hidden", "false");
  await page.keyboard.press("Space");
  await expect(content(hint)).toBeHidden();
});

test("blocked storage keeps independent choices for this tab", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === "japanese-reviewer:reading-visibility") throw new DOMException("blocked", "SecurityError");
      return original.call(this, name, value);
    };
  });
  await page.goto("/chapters/1");
  await aid(page, "english").uncheck();
  await expect(content(hints(page, "english").first())).toBeHidden();
  await expect(visibleMain(page)).toContainText("This browser cannot save these choices");
  await visibleMain(page).getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" }).click();
  await page.getByRole("link", { name: "Existential Sentences", exact: true }).click();
  await expect(aid(page, "english")).not.toBeChecked();
});

test("other tabs synchronize preferences without changing bookmark data", async ({ page, context }) => {
  await page.goto("/chapters/1");
  await expect(aid(page, "english")).toBeEnabled();
  const before = await page.evaluate(() => localStorage.getItem("japanese-reviewer:study"));
  const other = await context.newPage();
  await other.goto("/kana/1");
  await aid(page, "english").uncheck();
  await expect(aid(other, "english")).not.toBeChecked();
  await expect(content(hints(other, "english").first())).toBeHidden();
  // The reader itself records visits; preference changes do not touch that storage.
  const afterVisit = await page.evaluate(() => localStorage.getItem("japanese-reviewer:study"));
  await aid(page, "romaji").uncheck();
  expect(await page.evaluate(() => localStorage.getItem("japanese-reviewer:study"))).toBe(afterVisit);
  expect(before).not.toBeNull();
  await other.close();
});

test("phone controls wrap without clipping", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/kana/1");
  await aid(page, "romaji").uncheck();
  await aid(page, "english").uncheck();
  const fieldset = visibleMain(page).getByRole("group", { name: "Reading aids" });
  const box = await fieldset.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  const hint = hints(page, "romaji").first();
  await hint.getByRole("button").click();
  await expect(content(hint)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("japanese-reviewer:reading-visibility")!).version)).toBe(1);
});

test("saved hidden hints remain concealed during hydration", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, show: { romaji: false, english: false, furigana: false } }));
  }, key);
  await page.goto("/kanji/2");
  await expect(aid(page, "furigana")).not.toBeChecked();
  await expect(content(hints(page, "english").first())).toBeHidden();
  await expect(visibleMain(page).locator("[data-reading-word] rt").first()).toBeHidden();
});
