import { test, expect, visibleMain, type Page } from "./fixtures";
import raw from "../src/data/workbook-exercises.json";
import type { WorkbookBank } from "../src/types/workbook";
const sets = (raw as WorkbookBank).chapters.find(c => c.chapter === "14")!.sets;
const question = (page: Page, id: string) => visibleMain(page).locator('[data-workbook-question="' + id + '"]');

test("Chapter 14 appears after Chapter 13 with all nine activities and furigana on the book's kanji", async ({ page }) => {
  await page.goto("/");
  const link = visibleMain(page).locator('#chapters a[href="/chapters/14"]');
  await expect(link).toHaveText("Clothing, Before, Plans and But");
  await link.click();
  await expect(page).toHaveURL("/chapters/14");
  const main = visibleMain(page);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Clothing, Before, Plans and But");
  await expect(main.locator("[data-workbook-activity]")).toHaveCount(9);
  await expect(main.locator("[data-workbook-question]")).toHaveCount(80);
  await expect(main.getByRole("heading", { name: "ぶんけい 14.2 Dictionary Form + つもりです" })).toBeVisible();
  await expect(main.locator("#lessons h3 ruby")).toHaveCount(0);
  const row = main.locator("#lessons tr", { hasText: "Before going to Japan, I want to study Japanese." }).first();
  await expect(row.locator("rt").first()).toHaveText("にほん");
  const pager = main.getByRole("navigation", { name: "Chapter pages" });
  await expect(pager.getByRole("link")).toHaveCount(2);
  await expect(pager.getByRole("link").first()).toHaveAttribute("href", "/chapters/13");
  await expect(pager.getByRole("link").last()).toHaveAttribute("href", "/chapters/15");
});

test("all 66 checked Chapter 14 questions accept their model in the browser", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/chapters/14#exercises");
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

test("a kana answer to a まえに sentence is accepted, and a wrong one goes to the mistakes deck", async ({ page }) => {
  await page.goto("/chapters/14#c14-mae-ni");
  const right = question(page, "c14-mae-ni-3");
  await right.getByRole("textbox", { name: "Your answer", exact: true }).fill("くるまえに ともだちに でんわを かけます");
  await right.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(right.locator("[data-workbook-feedback]")).toContainText("Correct");
  const wrong = question(page, "c14-mae-ni-4");
  await wrong.getByRole("textbox", { name: "Your answer", exact: true }).fill("かえったまえに やさいを かいます");
  await wrong.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(wrong.locator("[data-workbook-feedback]")).not.toContainText("Correct");
  await expect(wrong.locator("[data-workbook-feedback]")).toContainText("やさいを");
  const cards = await page.evaluate(() => JSON.parse(localStorage.getItem("japanese-reviewer:flashcards")!).cards);
  expect(cards[0].sources[0].href).toBe("/chapters/14#c14-mae-ni");
});

test("Chapter 14 fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/chapters/14");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
