import { test, expect, visibleMain, type Page } from "./fixtures";
import raw from "../src/data/workbook-exercises.json";
import type { WorkbookBank } from "../src/types/workbook";
const sets = (raw as WorkbookBank).chapters.find(c => c.chapter === "15")!.sets;
const question = (page: Page, id: string) => visibleMain(page).locator('[data-workbook-question="' + id + '"]');

test("Chapter 15 appears after Chapter 14 with all nine activities and furigana on the book's kanji", async ({ page }) => {
  await page.goto("/");
  const link = visibleMain(page).locator('#chapters a[href="/chapters/15"]');
  await expect(link).toHaveText("After, Listing Actions, Only and Not At All");
  await link.click();
  await expect(page).toHaveURL("/chapters/15");
  const main = visibleMain(page);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("After, Listing Actions, Only and Not At All");
  await expect(main.locator("[data-workbook-activity]")).toHaveCount(9);
  await expect(main.locator("[data-workbook-question]")).toHaveCount(76);
  await expect(main.getByRole("heading", { name: "ぶんけい 15.2 〜たり、〜たり します" })).toBeVisible();
  await expect(main.locator("#lessons h3 ruby")).toHaveCount(0);
  const row = main.locator("#lessons tr", { hasText: "Last week I worked for only two days." }).first();
  await expect(row.locator("rt").first()).toHaveText("せんしゅう");
  const pager = main.getByRole("navigation", { name: "Chapter pages" });
  await expect(pager.getByRole("link")).toHaveCount(1);
  await expect(pager.getByRole("link")).toHaveAttribute("href", "/chapters/14");
});

test("all 61 checked Chapter 15 questions accept their model in the browser", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/chapters/15#exercises");
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

test("a kana answer to an あとで sentence is accepted, and a wrong one goes to the mistakes deck", async ({ page }) => {
  await page.goto("/chapters/15#c15-ato-forms");
  const right = question(page, "c15-ato-forms-1");
  await right.getByRole("textbox", { name: "Your answer", exact: true }).fill("クラスが おわったあと スーパーに いきます");
  await right.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(right.locator("[data-workbook-feedback]")).toContainText("Correct");
  const wrong = question(page, "c15-ato-forms-5");
  await wrong.getByRole("textbox", { name: "Your answer", exact: true }).fill("くすりを のむあとで ねます");
  await wrong.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(wrong.locator("[data-workbook-feedback]")).not.toContainText("Correct");
  await expect(wrong.locator("[data-workbook-feedback]")).toContainText("くすりを");
  const cards = await page.evaluate(() => JSON.parse(localStorage.getItem("japanese-reviewer:flashcards")!).cards);
  expect(cards[0].sources[0].href).toBe("/chapters/15#c15-ato-forms");
});

test("Chapter 15 fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/chapters/15");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
