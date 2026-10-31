import { test, expect, visibleMain, type Page } from "./fixtures";
import raw from "../src/data/workbook-exercises.json";
import type { WorkbookBank } from "../src/types/workbook";
const sets = (raw as WorkbookBank).chapters.find(c => c.chapter === "12")!.sets;
const question = (page: Page, id: string) => visibleMain(page).locator('[data-workbook-question="' + id + '"]');

test("Chapter 12 appears after Chapter 11 with all eight activities and furigana on the book's kanji", async ({ page }) => {
  await page.goto("/");
  const link = visibleMain(page).locator('#chapters a[href="/chapters/12"]');
  await expect(link).toHaveText("Reason, Volitional Form, Parts of the Body");
  await link.click();
  await expect(page).toHaveURL("/chapters/12");
  const main = visibleMain(page);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Reason, Volitional Form, Parts of the Body");
  await expect(main.locator("[data-workbook-activity]")).toHaveCount(8);
  await expect(main.locator("[data-workbook-question]")).toHaveCount(51);
  await expect(main.getByRole("heading", { name: "ぶんけい 12.7 ましょう" })).toBeVisible();
  await expect(main.locator("#lessons h3 ruby")).toHaveCount(0);
  const row = main.locator("#lessons tr", { hasText: "Why do you like Japanese?" }).first();
  await expect(row.locator("rt").first()).toHaveText("にほんご");
  const pager = main.getByRole("navigation", { name: "Chapter pages" });
  await expect(pager.getByRole("link")).toHaveCount(2);
  await expect(pager.getByRole("link").first()).toHaveAttribute("href", "/chapters/11");
  await expect(pager.getByRole("link").last()).toHaveAttribute("href", "/chapters/13");
});

test("all 37 checked Chapter 12 questions accept their model in the browser", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/chapters/12#exercises");
  for (const set of sets) for (const q of set.questions) {
    if (q.mode === "self") continue;
    const item = question(page, q.id);
    if (q.mode === "choice") await item.locator('input[value="' + q.correctChoiceId + '"]').check();
    else if (q.mode === "text") await item.getByRole("textbox", { name: "Your answer", exact: true }).fill(q.model);
    else for (const id of q.acceptedOrders![0]) await item.locator("[data-workbook-tiles] button").nth(id).click();
    await item.getByRole("button", { name: "Check answer", exact: true }).click();
    await expect(item.locator("[data-workbook-feedback]")).toContainText("Correct");
  }
});

test("the reason matching uses letters a to f, and a wrong answer goes to the mistakes deck", async ({ page }) => {
  await page.goto("/chapters/12#c12-reason-choices");
  const item = question(page, "c12-reason-choices-1");
  await expect(item.locator("input[type=radio]")).toHaveCount(6);
  await item.locator('input[value="a"]').check();
  await item.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(item.locator("[data-workbook-feedback]")).toContainText("おそく おきました から");
  const cards = await page.evaluate(() => JSON.parse(localStorage.getItem("japanese-reviewer:flashcards")!).cards);
  expect(cards[0].sources[0].href).toBe("/chapters/12#c12-reason-choices");
});

test("Chapter 12 fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/chapters/12");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
