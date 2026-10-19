import type { Page, Locator } from "@playwright/test";
import { test, expect, visibleMain, search } from "./fixtures";
import audit from "../migration/reading-exercise-audit.json";

const readings = (page: Page) => visibleMain(page).locator("[data-reading-exercise]");
const reading = (page: Page, heading: string) => visibleMain(page).locator('[data-reading-exercise="' + heading + '"]');
const support = (region: Locator, kind: string) => region.locator('details[data-reading-support="' + kind + '"]');
const questions = (region: Locator) => region.locator(".reading-questions tbody td:nth-child(2)");
const bookPassage = audit.passages.find(passage => passage.heading === "c9-read-and-answer-page-144")!;

for (const chapter of ["5", "6", "7", "8", "9", "10"]) {
  test("Chapter " + chapter + ": both readings start in Japanese with hidden independent support", async ({ page }) => {
    const passages = audit.passages.filter(passage => passage.chapter === chapter);
    await page.goto("/chapters/" + chapter + "#" + passages[0].heading);
    await expect(readings(page)).toHaveCount(2);
    for (const passage of passages) {
      const region = reading(page, passage.heading);
      await expect(region.locator(".reading-passage")).toHaveText(passage.japanese);
      await expect(questions(region)).toHaveCount(passage.questions.length);
      expect(await questions(region).allTextContents()).toEqual(passage.questions.map(question => question.japanese));
      for (const text of await questions(region).allTextContents()) {
        expect(text.replace(/N[345]/g, "")).not.toMatch(/[A-Za-z]/);
      }
      for (const kind of ["romaji", "english"]) {
        await expect(support(region, kind)).not.toHaveAttribute("open");
        await expect(support(region, kind).locator("p")).toBeHidden();
      }
      await support(region, "romaji").locator("summary").click();
      await expect(support(region, "romaji").locator("p")).toHaveText(passage.romaji);
      await expect(support(region, "romaji").locator("p")).toBeVisible();
      await expect(support(region, "english").locator("p")).toBeHidden();
      await support(region, "english").locator("summary").click();
      await expect(support(region, "english").locator("p")).toHaveText(passage.english);
      await expect(support(region, "english").locator("p")).toBeVisible();
      await support(region, "romaji").locator("summary").click();
      await expect(support(region, "romaji").locator("p")).toBeHidden();
      await expect(support(region, "english").locator("p")).toBeVisible();
    }
    await page.reload();
    for (const passage of passages) {
      for (const kind of ["romaji", "english"]) await expect(support(reading(page, passage.heading), kind)).not.toHaveAttribute("open");
    }
  });
}

test("reading support uses keyboard controls and stays independent of global aids and stored study choices", async ({ page }) => {
  await page.goto("/chapters/8#c8-part-v-read-and-answer");
  const region = reading(page, "c8-part-v-read-and-answer");
  // Showing all ordinary lesson aids does not expose a reading exercise.
  for (const kind of ["romaji", "english"]) await visibleMain(page).getByRole("checkbox", { name: "Show " + kind, exact: true }).check();
  await expect(support(region, "english").locator("p")).toBeHidden();
  for (const kind of ["romaji", "english"]) await visibleMain(page).getByRole("checkbox", { name: "Show " + kind, exact: true }).uncheck();
  const before = await page.evaluate(() => ({
    aids: localStorage.getItem("japanese-reviewer:reading-visibility"),
    flashcards: localStorage.getItem("japanese-reviewer:flashcards"),
    study: localStorage.getItem("japanese-reviewer:study"),
  }));
  const summary = support(region, "english").locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(support(region, "english").locator("p")).toBeVisible();
  await expect(support(region, "romaji").locator("p")).toBeHidden();
  await expect(support(readings(page).nth(1), "english").locator("p")).toBeHidden();
  await page.keyboard.press("Space");
  await expect(support(region, "english").locator("p")).toBeHidden();
  const after = await page.evaluate(() => ({
    aids: localStorage.getItem("japanese-reviewer:reading-visibility"),
    flashcards: localStorage.getItem("japanese-reviewer:flashcards"),
    study: localStorage.getItem("japanese-reviewer:study"),
  }));
  expect(after).toEqual(before);
});

test("only untaught vocabulary has a note, placed below the passage and before optional support", async ({ page }) => {
  await page.goto("/chapters/9#" + bookPassage.heading);
  const region = reading(page, bookPassage.heading);
  const note = region.getByRole("complementary", { name: "Vocabulary notes" });
  await expect(note).toBeVisible();
  await expect(note).toContainText("これから");
  await expect(note).toContainText("after this; from now on");
  await expect(note).toContainText("Question 2");
  const order = await region.evaluate(element => {
    const passage = element.querySelector(".reading-passage")!;
    const notes = element.querySelector(".reading-vocabulary")!;
    const aids = element.querySelector(".reading-support")!;
    return Boolean(passage.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      Boolean(notes.compareDocumentPosition(aids) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  await expect(support(region, "english").locator("p")).toBeHidden();
  await page.goto("/chapters/8#c8-part-v-read-and-answer");
  await expect(reading(page, "c8-part-v-read-and-answer").getByRole("complementary")).toHaveCount(0);
  await expect(reading(page, "c8-part-v-read-and-answer")).not.toContainText("Words:");
});

test("search shows optional translation content and opens the reading at its unchanged heading", async ({ page }) => {
  const query = "Ben gets up at half past six every day";
  await page.goto("/?q=" + encodeURIComponent(query) + "&category=practice&chapter=8");
  const result = search(page).results.first();
  await expect(result).toContainText(query);
  const link = result.getByRole("link").first();
  await expect(link).toHaveAttribute("href", "/chapters/8#c8-part-v-read-and-answer");
  await link.click();
  await expect(page).toHaveURL("/chapters/8#c8-part-v-read-and-answer");
  await expect(support(reading(page, "c8-part-v-read-and-answer"), "english").locator("p")).toBeHidden();
  await expect(reading(page, "c8-part-v-read-and-answer").locator(".reading-passage")).toBeVisible();
});

test("phone: Japanese passages, support controls and question tables stay inside the page", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/chapters/8#c8-part-v-read-and-answer");
  const region = reading(page, "c8-part-v-read-and-answer");
  await expect(region).toBeVisible();
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    const wrapper = region.locator(".reading-questions");
    const bounds = await wrapper.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    for (const kind of ["romaji", "english"]) {
      expect((await support(region, kind).locator("summary").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await region.screenshot({ path: testInfo.outputPath("reading-exercises-phone.png"), style: "header { visibility: hidden !important; }" });
  await support(region, "english").locator("summary").click();
  await expect(support(region, "english").locator("p")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("the specialized reading panels stay on chapter pages", async ({ page }) => {
  for (const path of ["/kana/1", "/kanji/1", "/practice/1"]) {
    await page.goto(path);
    await expect(readings(page)).toHaveCount(0);
    await expect(visibleMain(page).getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test.describe("native reading support", () => {
  test.use({ javaScriptEnabled: false });
  test("starts closed and can be revealed without JavaScript", async ({ page, browserProblems }) => {
    await page.goto("/chapters/5#c5-part-v-read-and-answer");
    const region = reading(page, "c5-part-v-read-and-answer");
    await expect(support(region, "romaji").locator("p")).toBeHidden();
    await expect(support(region, "english").locator("p")).toBeHidden();
    await support(region, "english").locator("summary").click();
    await expect(support(region, "english").locator("p")).toBeVisible();
    await expect(support(region, "romaji").locator("p")).toBeHidden();
    // Chromium can report a module preload as CSP-blocked when this test
    // deliberately disables JavaScript. Keep all other fixture error checks.
    for (let index = browserProblems.length - 1; index >= 0; index--) {
      const problem = browserProblems[index];
      if (problem.startsWith("request failed: ") && problem.includes("/_next/static/chunks/") && problem.endsWith(".js (csp)")) {
        browserProblems.splice(index, 1);
      }
    }
  });
});
