import { test, expect, visibleMain } from "./fixtures";

test("Kanji 3 is listed after Kanji 2 and has 30 kanji, the self-test and model answers", async ({ page }) => {
  await page.goto("/");
  const link = visibleMain(page).locator('#kana-kanji a[href="/kanji/3"]');
  await expect(link).toHaveText("Adjectives, Colors and Everyday Verbs");
  await link.click();
  await expect(page).toHaveURL("/kanji/3");
  const main = visibleMain(page);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Adjectives, Colors and Everyday Verbs");
  await expect(main.locator("#lessons h3").filter({ hasText: /^. \(/ })).toHaveCount(30);
  await expect(main.locator("#exercises h3").filter({ hasText: /^Part [A-J]:/ })).toHaveCount(10);
  await expect(main.locator("#answers")).toContainText("They are model answers, not the official answer key.");
  const pager = main.getByRole("navigation", { name: "Kanji pages" });
  await expect(pager.getByRole("link")).toHaveCount(2);
  await expect(pager.getByRole("link").first()).toHaveAttribute("href", "/kanji/2");
  await expect(pager.getByRole("link").last()).toHaveAttribute("href", "/kanji/4");
});

test("Kanji 3 fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/kanji/3");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
