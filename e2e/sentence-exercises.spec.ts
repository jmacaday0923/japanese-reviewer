import catalog from "../src/data/japanese-display.json";
import { studyDisplay } from "../src/lib/study-markup";
import type { Locator, Page } from "@playwright/test";
import { test, expect, visibleMain } from "./fixtures";
import bank from "../src/data/sentence-exercises.json";

const chapter = (number: string) => bank.chapters.find(item => item.chapter === number)!;
const practice = (page: Page) => visibleMain(page).getByRole("region", { name: "Sentence building", exact: true });
const panel = (page: Page) => practice(page).getByRole("tabpanel");
const row = (page: Page, id: string) => panel(page).locator('[data-sentence-question="' + id + '"]');
const feedback = (question: Locator) => question.locator('[id$="-feedback"]');
const tile = (question: Locator, id: number) => question.locator('[data-tile-bank] button[data-token-id="' + id + '"]');
const check = (question: Locator) => question.getByRole("button", { name: /^Check answer/ });
async function select(question: Locator, ids: number[]) {
  for (const id of ids) await tile(question, id).click();
}
const correctOrder = (tokens: string[]) => tokens.map((_, index) => index);

// Keep the old Particles/Vocabulary region independent: these assertions use the new region only.
test("all chapters offer source-backed puzzles; transformation links and study-page boundaries", async ({ page }) => {
  for (const entry of bank.chapters) {
    await page.goto("/chapters/" + entry.chapter + "#exercises");
    await expect(practice(page)).toBeVisible();
    await expect(practice(page).getByRole("tab", { name: "Word order (3)", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(panel(page).locator("[data-sentence-question]")).toHaveCount(3);
    await expect(practice(page).getByRole("tab", { name: /^Transformations/ })).toHaveCount(entry.transformations.length ? 1 : 0);
    if (!entry.transformations.length) {
      await expect(practice(page).getByRole("link", { name: "Chapter 10", exact: true })).toHaveAttribute("href", "/chapters/10#exercises");
    }
  }
  for (const path of ["/kana/1", "/kanji/1", "/practice/1"]) {
    await page.goto(path);
    await expect(practice(page)).toHaveCount(0);
  }
});

test("tiles support keyboard selection, removal, undo, clear, blank checks and source feedback", async ({ page }) => {
  await page.goto("/chapters/1#exercises");
  const q = chapter("1").order[0];
  const item = row(page, q.id);
  await expect(feedback(item)).toBeEmpty();
  const initialOrder = await item.locator("[data-tile-bank] button").allTextContents();
  expect(initialOrder).not.toEqual(q.tokens);
  await check(item).click();
  await expect(feedback(item)).toHaveText("Use every tile before checking.");
  await expect(item.locator("[data-tile-bank] button:not([disabled])").first()).toBeFocused();
  await expect(panel(page)).not.toContainText("First try:");

  await tile(item, 0).focus();
  await page.keyboard.press("Enter");
  await expect(tile(item, 0)).toBeDisabled();
  await expect(item.locator("[data-chosen-tiles] button")).toHaveCount(1);
  await check(item).click();
  await expect(feedback(item)).not.toContainText("Model answer");
  await item.getByRole("button", { name: /^Remove/ }).click();
  await expect(tile(item, 0)).toBeEnabled();
  await select(item, [0, 1]);
  await item.getByRole("button", { name: "Undo last tile", exact: true }).click();
  await expect(item.locator("[data-chosen-tiles] button")).toHaveCount(1);
  await item.getByRole("button", { name: "Clear sentence", exact: true }).click();
  await expect(item.locator("[data-chosen-tiles] button")).toHaveCount(0);

  await select(item, correctOrder(q.tokens).reverse());
  await check(item).click();
  await expect(feedback(item)).toContainText("Incorrect");
  await expect(feedback(item)).toContainText(studyDisplay(catalog, q.why).primary);
  await expect(feedback(item)).toBeFocused();
  await expect(feedback(item).getByRole("link")).toHaveAttribute("href", "#" + q.example.source.heading);
  await item.getByRole("button", { name: "Clear sentence", exact: true }).click();
  await expect(feedback(item)).toBeEmpty();
  await select(item, correctOrder(q.tokens));
  await check(item).click();
  await expect(feedback(item)).toContainText("Correct");
  await expect(check(item)).toBeDisabled();
  await expect(item.locator("[data-tile-bank] button:not([disabled])")).toHaveCount(0);
  expect(await item.locator("[data-tile-bank] button").allTextContents()).toEqual(initialOrder);
});

test("retry preserves correct answers and first score; tabs retain progress; restart and reload reset", async ({ page }) => {
  await page.goto("/chapters/1#exercises");
  const questions = chapter("1").order;
  for (const [index, q] of questions.entries()) {
    const item = row(page, q.id);
    const order = correctOrder(q.tokens);
    await select(item, index === 0 ? order.reverse() : order);
    await check(item).click();
  }
  await expect(panel(page)).toContainText("First try: 2 of 3 correct");
  await panel(page).getByRole("button", { name: "Retry incorrect (1)", exact: true }).click();
  const first = row(page, questions[0].id);
  await expect(first.locator("[data-tile-bank] button:not([disabled])").first()).toBeFocused();
  await expect(first.locator("[data-chosen-tiles] button")).toHaveCount(0);
  await expect(check(row(page, questions[1].id))).toBeDisabled();
  await select(first, correctOrder(questions[0].tokens));
  await check(first).click();
  await expect(panel(page)).toContainText("All 3 questions correct. Practice complete.");
  await expect(panel(page)).toContainText("First try: 2 of 3 correct");

  const orderTab = practice(page).getByRole("tab", { name: /^Word order/ });
  await orderTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(practice(page).getByRole("tab", { name: /^Transformations/ })).toBeFocused();
  const transform = row(page, chapter("1").transformations[0].id);
  await transform.getByRole("textbox").fill("watashi wa nihonjin dewa arimasen");
  await page.keyboard.press("Enter");
  await expect(feedback(transform)).toContainText("Correct");
  await practice(page).getByRole("tab", { name: /^Transformations/ }).focus();
  await page.keyboard.press("Home");
  await expect(panel(page)).toContainText("All 3 questions correct. Practice complete.");
  await panel(page).getByRole("button", { name: "Restart practice", exact: true }).click();
  await expect(first.locator("[data-chosen-tiles] button")).toHaveCount(0);
  await expect(panel(page)).not.toContainText("First try:");
  await practice(page).getByRole("tab", { name: /^Transformations/ }).click();
  await expect(transform.getByRole("textbox")).toHaveJSProperty("readOnly", true);
  await page.reload();
  await practice(page).getByRole("tab", { name: /^Transformations/ }).click();
  await expect(transform.getByRole("textbox")).toHaveValue("");
});

test("typed negative forms handle blank answers and IME Enter; equivalent source forms are accepted", async ({ page }) => {
  await page.goto("/chapters/1#exercises");
  await practice(page).getByRole("tab", { name: /^Transformations/ }).click();
  const q = chapter("1").transformations[0];
  const item = row(page, q.id);
  const input = item.getByRole("textbox");
  await check(item).click();
  await expect(input).toBeFocused();
  await expect(feedback(item)).toHaveText("Type an answer before checking.");
  await input.fill(q.original.japanese);
  await input.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(feedback(item)).toContainText("Incorrect");
  await expect(feedback(item)).toContainText(studyDisplay(catalog, q.why).primary);
  await input.fill("WATASHI WA NIHONJIN JA ARIMASEN.");
  await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  await expect(feedback(item)).toBeEmpty();
  await input.press("Enter");
  await expect(feedback(item)).toContainText("Correct");
  await expect(input).toHaveJSProperty("readOnly", true);

  await page.goto("/chapters/6#exercises");
  await practice(page).getByRole("tab", { name: /^Transformations/ }).click();
  const exception = chapter("6").transformations.find(question => question.original.japanese.startsWith("いい"))!;
  const exceptionItem = row(page, exception.id);
  await exceptionItem.getByRole("textbox").fill(exception.answer.japanese);
  await check(exceptionItem).click();
  await expect(feedback(exceptionItem)).toContainText("Correct");
  await expect(feedback(exceptionItem)).toContainText(studyDisplay(catalog, exception.why).primary);
});

test("casual transformations accept the printed optional particle and preserve past tense", async ({ page }) => {
  await page.goto("/chapters/10#exercises");
  await practice(page).getByRole("tab", { name: /^Transformations/ }).click();
  const q = chapter("10").transformations.find(question => question.answer.japanese.includes("(を)"))!;
  const item = row(page, q.id);
  await item.getByRole("textbox").fill(q.original.japanese);
  await check(item).click();
  await expect(feedback(item)).toContainText("Incorrect");
  await item.getByRole("textbox").fill(q.answer.japanese.replace("(を)", ""));
  await check(item).click();
  await expect(feedback(item)).toContainText("Correct");
  await expect(feedback(item)).toContainText("permits omitting the particle");
  const past = chapter("10").transformations.find(question => question.answer.japanese.includes("しなかった"))!;
  const pastItem = row(page, past.id);
  await pastItem.getByRole("textbox").fill(past.answer.japanese.replace("しなかった", "しない"));
  await check(pastItem).click();
  await expect(feedback(pastItem)).toContainText("Incorrect");
  await pastItem.getByRole("textbox").fill(past.answer.romaji);
  await check(pastItem).click();
  await expect(feedback(pastItem)).toContainText("Correct");
});

test("answer hints follow reading preferences; the task cue and Japanese model remain available", async ({ page }) => {
  await page.goto("/chapters/1#exercises");
  for (const name of ["Show romaji", "Show english"]) {
    await visibleMain(page).getByRole("checkbox", { name, exact: true }).uncheck();
  }
  const q = chapter("1").order[0];
  const item = row(page, q.id);
  await expect(item.getByText(q.example.english, { exact: false })).toBeVisible();
  await select(item, correctOrder(q.tokens));
  await check(item).click();
  const answer = feedback(item);
  await expect(answer.locator('[lang="ja"]')).toHaveText(q.example.japanese);
  for (const kind of ["romaji", "english"]) {
    const hint = answer.locator('[data-reading-hint="' + kind + '"]').first();
    await expect(hint.locator(":scope > span[id]")).toBeHidden();
    await hint.getByRole("button").click();
    await expect(hint.locator(":scope > span[id]")).toBeVisible();
  }
  await visibleMain(page).getByRole("button", { name: "Hide revealed hints", exact: true }).click();
  for (const hint of await answer.locator('[data-reading-hint="romaji"] > span[id]').all()) await expect(hint).toBeHidden();
  await expect(answer.locator("ruby, rt")).toHaveCount(0);
});

test("phone: tiles, model answers and transformation fields fit the panel", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/chapters/10#exercises");
  const q = chapter("10").order[0];
  const item = row(page, q.id);
  await select(item, correctOrder(q.tokens));
  await check(item).click();
  await expect(feedback(item)).toContainText("Correct");
  expect(await practice(page).evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
  const buttons = item.locator("button");
  for (const button of await buttons.all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await item.screenshot({ path: testInfo.outputPath("sentence-building-order-phone.png") });
  await practice(page).getByRole("tab", { name: /^Transformations/ }).click();
  const transform = row(page, chapter("10").transformations[0].id);
  await transform.getByRole("textbox").fill(chapter("10").transformations[0].answer.japanese);
  await check(transform).click();
  await expect(feedback(transform)).toContainText("Correct");
  expect(await practice(page).evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
  await transform.screenshot({ path: testInfo.outputPath("sentence-building-phone.png") });
  await page.setViewportSize({ width: 320, height: 750 });
  expect(await practice(page).evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
});
