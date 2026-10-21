import { test, expect, visibleMain, type Page } from "./fixtures";
import audit from "../migration/older-chapter-audit.json";
import supportBank from "../src/data/chapter-reading-support.json";
const group = (page: Page, heading: string) => visibleMain(page).locator('[data-legacy-exercise="' + heading + '"]');
const row = (page: Page, heading: string, number = 1) => group(page, heading).locator("tbody tr").nth(number - 1);

for (const chapter of audit.chapters) test("Chapter " + chapter.chapter + ": every source question has interactive answers and bilingual directions", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("japanese-reviewer:reading-visibility", JSON.stringify({
    version: 2, show: { kana: true, romaji: false, english: false },
  })));
  await page.goto("/chapters/" + chapter.chapter + "#exercises");
  await expect(visibleMain(page).getByRole("checkbox", { name: "Show english", exact: true })).not.toBeChecked();
  const actual = await visibleMain(page).locator("[data-legacy-exercise]").evaluateAll(elements => elements.map(element => ({
    heading: element.getAttribute("data-legacy-exercise"),
    mode: element.getAttribute("data-grading-mode"),
    rows: element.querySelectorAll("tbody tr").length,
    disclosures: element.querySelectorAll("tbody td:nth-child(3) > details").length,
    inputs: element.querySelectorAll("textarea, input").length,
  })));
  expect(actual).toEqual(chapter.sets.map(set => ({ heading: set.heading, mode: set.mode, rows: set.rows.length, disclosures: set.rows.length, inputs: 0 })));
  const directions = visibleMain(page).locator("[data-exercise-directions]");
  await expect(directions).toHaveCount(chapter.activities);
  expect(await directions.evaluateAll(elements => elements.every(el =>
    el.querySelector('p[lang="ja"]')?.checkVisibility() && el.querySelector('[lang="en"]')?.checkVisibility()
  ))).toBe(true);
  await expect(visibleMain(page).getByRole("navigation", { name: "Chapter study steps" }).getByRole("link")).toHaveCount(5);
  await expect(visibleMain(page).locator("[data-chapter-study-plan]")).toContainText(chapter.questions + " workbook and review questions");
});

test("particles: blank focus, incorrect answers, retries and first scores work in the source table", async ({ page }) => {
  const heading = "c1-part-a-fill-in-the-marker-wa-no-to-ka-or";
  const set = audit.chapters[0].sets.find(s => s.heading === heading)!;
  await page.goto("/chapters/1#" + heading);
  const first = row(page, heading);
  await first.locator("summary").click();
  await first.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(first.getByRole("textbox")).toBeFocused();
  await expect(first.locator("[data-exercise-feedback]")).toHaveCount(0);
  for (const [index, q] of set.rows.entries()) {
    const item = row(page, heading, index + 1);
    if (index) await item.locator("summary").click();
    await item.getByRole("textbox").fill(index === 0 ? "わ" : q.accepted[0]);
    await item.getByRole("button", { name: "Check answer", exact: true }).click();
  }
  await expect(group(page, heading)).toContainText("First try: 7 of 8 correct");
  await group(page, heading).getByRole("button", { name: /^Retry incorrect/ }).click();
  await expect(first.getByRole("textbox")).toBeEmpty();
  await expect(row(page, heading, 2).getByRole("textbox")).toBeDisabled();
  await first.getByRole("textbox").fill("は");
  await first.getByRole("textbox").press("Enter");
  await expect(first.locator("[data-exercise-feedback]")).toContainText("Correct");
  await expect(group(page, heading)).toContainText("First try: 7 of 8 correct");
});

test("kana checking preserves IME confirmation and checks the explicitly printed form", async ({ page }) => {
  const heading = "c1-part-f-family-words";
  await page.goto("/chapters/1#" + heading);
  const item = row(page, heading);
  await item.locator("summary").focus(); await page.keyboard.press("Enter");
  const input = item.getByRole("textbox");
  await input.fill("ちち");
  await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, keyCode: 229 });
  await expect(item.locator("[data-exercise-feedback]")).toHaveCount(0);
  await input.press("Enter");
  await expect(item.locator("[data-exercise-feedback]")).toContainText("Correct");
  await expect(input).toBeDisabled();
});

test("four-choice source questions can be answered and checked with keyboard controls", async ({ page }) => {
  const heading = "c1-selecting-grammar-form-page-20";
  await page.goto("/chapters/1#" + heading);
  const item = row(page, heading);
  await item.locator("summary").click();
  await item.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(item.locator('input[value="1"]')).toBeFocused();
  await item.locator('input[value="4"]').focus(); await page.keyboard.press("Space");
  await item.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(item.locator("[data-exercise-feedback]")).toContainText("Correct");
  await expect(item.getByRole("link", { name: "Source answer key", exact: true })).toHaveAttribute("href", "#" + heading + "-2");
});

test("open Japanese answers are compared with a model and never assigned an automatic correctness score", async ({ page }) => {
  const heading = "c8-part-u-answer-the-question";
  await page.addInitScript(() => localStorage.setItem("japanese-reviewer:reading-visibility", JSON.stringify({
    version: 2, show: { kana: true, romaji: false, english: false },
  })));
  await page.goto("/chapters/8#" + heading);
  const first = row(page, heading), second = row(page, heading, 2);
  await first.locator("summary").click();
  await first.getByRole("textbox").fill("けさ、パンを食べました。");
  await first.getByRole("button", { name: "Show model answer", exact: true }).click();
  await expect(first.locator("[data-exercise-feedback]")).toContainText("Other valid answers may differ");
  const hint = first.locator('[data-exercise-feedback] [data-reading-hint="english"]');
  await expect(hint.locator(":scope > span[id]")).toBeHidden();
  await hint.getByRole("button", { name: "Reveal English for question 1 explanation", exact: true }).click();
  await expect(hint.locator(":scope > span[id]")).toBeVisible();
  await first.getByRole("button", { name: "Needs review", exact: true }).click();
  await second.locator("summary").click();
  await second.getByRole("textbox").fill("喫茶店でコーヒーを飲みます。");
  await second.getByRole("button", { name: "Show model answer", exact: true }).click();
  await second.getByRole("button", { name: "I’m satisfied", exact: true }).click();
  await expect(group(page, heading).locator("[data-legacy-self-summary]")).toHaveText("1 satisfied · 1 need review · 6 not compared");
  await group(page, heading).getByRole("button", { name: "Retry needs review", exact: true }).click();
  await expect(first.getByRole("textbox")).toBeEmpty();
  await expect(second.getByRole("textbox")).toBeDisabled();
  await expect(group(page, heading)).not.toContainText("First try");
});

test("answers survive aid toggles and closing a row; a reload starts fresh without new storage", async ({ page }) => {
  const heading = "c8-part-u-answer-the-question";
  await page.addInitScript(() => localStorage.setItem("japanese-reviewer:reading-visibility", JSON.stringify({
    version: 2, show: { kana: true, romaji: false, english: true },
  })));
  await page.goto("/chapters/8#" + heading);
  await expect(visibleMain(page).getByRole("checkbox", { name: "Show romaji", exact: true })).toBeEnabled();
  const item = row(page, heading);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  await item.locator("summary").click();
  await item.getByRole("textbox").fill("パンを食べました。");
  await item.locator("summary").click(); await item.locator("summary").click();
  await expect(item.getByRole("textbox")).toHaveValue("パンを食べました。");
  await visibleMain(page).getByRole("checkbox", { name: "Show romaji", exact: true }).check();
  await expect(item.getByRole("textbox")).toHaveValue("パンを食べました。");
  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(keys);
  await page.reload();
  await expect(item.locator("details")).not.toHaveAttribute("open");
  await item.locator("summary").click();
  await expect(item.getByRole("textbox")).toBeEmpty();
});

for (const width of [320, 375]) test(width + "px: Japanese prompts, model answers and exercise controls fit", async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const heading = "c8-part-u-answer-the-question";
  await page.goto("/chapters/8#" + heading);
  const item = row(page, heading);
  expect((await item.locator("summary").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await item.locator("summary").click();
  await item.getByRole("textbox").fill("パンを食べました。");
  await item.getByRole("button", { name: "Show model answer", exact: true }).click();
  await expect(item.locator("[data-exercise-feedback]")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await group(page, heading).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await item.locator("td").nth(1).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
});

for (const chapter of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]) test("Chapter " + chapter + ": added passage translations start closed and reveal independently", async ({ page }) => {
  const supports = supportBank.activities.filter(s => s.heading.startsWith("c" + chapter + "-"));
  await page.goto("/chapters/" + chapter + "#" + supports[0].heading);
  await expect(visibleMain(page).locator("[data-older-translation]")).toHaveCount(supports.length);
  for (const support of supports) {
    const panel = visibleMain(page).locator('[data-older-translation="' + support.heading + '"]');
    await expect(panel).not.toHaveAttribute("open");
    await expect(panel.locator("p").first()).toBeHidden();
    await panel.locator("summary").focus(); await page.keyboard.press("Enter");
    await expect(panel.locator("p")).toHaveText(support.english);
    await expect(panel.locator("p").first()).toBeVisible();
    const region = panel.locator("xpath=ancestor::section[contains(@class,'workbook-activity')]");
    const romaji = region.locator("details[data-workbook-romaji]");
    if (await romaji.count()) await expect(romaji).not.toHaveAttribute("open");
  }
  await page.reload();
  for (const support of supports) await expect(visibleMain(page).locator('[data-older-translation="' + support.heading + '"]')).not.toHaveAttribute("open");
});
