import { test, expect, visibleMain } from "./fixtures";

test("Kanji 4 is listed after Kanji 3 and has 30 kanji, the self-test and model answers", async ({ page }) => {
  await page.goto("/");
  const link = visibleMain(page).locator('#kana-kanji a[href="/kanji/4"]');
  await expect(link).toHaveText("Verbs, Words and Places in Town");
  await link.click();
  await expect(page).toHaveURL("/kanji/4");
  const main = visibleMain(page);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Verbs, Words and Places in Town");
  await expect(main.locator("#lessons h3").filter({ hasText: /^. \(/ })).toHaveCount(30);
  await expect(main.locator("#exercises h3").filter({ hasText: /^Part [A-J]:/ })).toHaveCount(10);
  await expect(main.locator("#answers")).toContainText("They are model answers, not the official answer key.");
  const pager = main.getByRole("navigation", { name: "Kanji pages" });
  await expect(pager.getByRole("link")).toHaveCount(1);
  await expect(pager.getByRole("link")).toHaveAttribute("href", "/kanji/3");
});

test("Kanji 4 fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/kanji/4");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
