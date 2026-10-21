import { test, expect, visibleMain, offsetFromAnchorTarget } from "./fixtures";
import exams from "../src/data/checkpoint-exams.json";
const exam = exams.find(e => e.id === "chapter-5")!;
const path = "/checkpoints/chapter-5";
const key = "japanese-reviewer:checkpoint:chapter-5:v1";
const questions = exam.parts.flatMap(p => p.questions);
const reading = exam.parts[1];
test("Chapter 5 and the dashboard link to one combined 54-question checkpoint", async ({ page }) => {
  await page.goto("/chapters/5");
  await visibleMain(page).getByRole("link", { name: "Chapter 5 checkpoint", exact: true }).click();
  await expect(page).toHaveURL(path);
  await expect(visibleMain(page)).toContainText("0 / 54 answered");
  await expect(visibleMain(page)).toContainText("Chapters 1–5");
  await page.goto("/");
  const card = visibleMain(page).locator('#checkpoints a[href="' + path + '"]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("54 questions");
  await expect(visibleMain(page).getByRole("heading", { name: "Practice", exact: true })).toHaveCount(0);
});
test("both parts, saved answers and the old address share one attempt", async ({ page }) => {
  await page.goto(path);
  await visibleMain(page).locator('[data-checkpoint-question]').first().getByRole("radio").nth(1).check();
  await visibleMain(page).getByRole("button", { name: /^Reading/ }).click();
  await expect(visibleMain(page).locator("[data-checkpoint-passage]")).toHaveCount(3);
  await expect(visibleMain(page).locator("[data-checkpoint-question]")).toHaveCount(14);
  await visibleMain(page).locator("[data-checkpoint-question]").first().getByRole("radio").nth(2).check();
  await expect(visibleMain(page).locator("[data-reading-hint], [data-checkpoint-feedback]")).toHaveCount(0);
  await page.goto("/practice/1");
  await expect(visibleMain(page).getByRole("button", { name: /^Reading/ })).toHaveAttribute("aria-current", "step");
  await expect(visibleMain(page).locator("[data-checkpoint-question]").first().getByRole("radio").nth(2)).toBeChecked();
  await page.reload();
  await expect(visibleMain(page)).toContainText("2 / 54 answered");
  await page.goto("/checkpoints/vocabulary");
  await expect(visibleMain(page)).toContainText("0 / 40 answered");
});
test("submit all 54, review translations, and retry without replacing the assessment", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("japanese-reviewer:reading-visibility", JSON.stringify({ version: 2, show: { kana: true, romaji: false, english: false } })));
  await page.goto(path);
  for (const part of exam.parts) {
    await visibleMain(page).getByRole("button", { name: new RegExp("^" + part.title) }).click();
    for (const question of part.questions) {
      const answer = question.number === 1 ? question.choices.find(c => c.id !== question.correctChoiceId)!.id : question.correctChoiceId;
      await visibleMain(page).locator('[data-checkpoint-question="' + question.id + '"] input[value="' + answer + '"]').check();
    }
  }
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await expect(visibleMain(page).locator("[data-first-score]")).toHaveText("First submission: 53 / 54 · 98%");
  await expect(visibleMain(page).locator("[data-chapter-results] > li")).toHaveCount(5);
  await expect(visibleMain(page).locator("[data-chapter-results]")).not.toContainText("Chapter 6");
  const translation = visibleMain(page).getByRole("button", { name: /Reveal English for Chapter 5 checkpoint passage chapter-5-passage-1/ });
  await translation.click();
  await expect(visibleMain(page).getByText(/Passage 1\. My name is Maria/)).toBeVisible();
  await visibleMain(page).getByRole("button", { name: "Retry incorrect", exact: true }).click();
  await expect(visibleMain(page).getByRole("button", { name: /^Vocabulary/ })).toHaveAttribute("aria-current", "step");
  const first = visibleMain(page).locator('[data-checkpoint-question="' + questions[0].id + '"]');
  await expect(first.locator("input:checked")).toHaveCount(0);
  await expect(visibleMain(page).locator('[data-checkpoint-question="' + questions[1].id + '"] input:checked')).toBeDisabled();
  await first.locator('input[value="' + questions[0].correctChoiceId + '"]').check();
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await expect(visibleMain(page).locator("[data-practice-score]")).toContainText("54 / 54");
  await page.reload();
  await expect(visibleMain(page).locator("[data-first-score]")).toContainText("53 / 54");
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  expect(saved.history).toHaveLength(1);
  expect(saved.history[0]).toMatchObject({ correct: 53, total: 54, unanswered: 0 });
});
test("legacy passage and key fragments open the right questions without revealing answers", async ({ page }) => {
  const anchor = "p1-exam-2-passage-2-a-shop-sign";
  for (const suffix of ["", "-2"]) {
    await page.goto("/practice/1#" + anchor + suffix);
    await expect(visibleMain(page).getByRole("button", { name: /^Reading/ })).toHaveAttribute("aria-current", "step");
    await expect(visibleMain(page).locator('[data-checkpoint-passage="chapter-5-passage-2"]')).toContainText("ほんや ミナミ");
    await expect.poll(() => offsetFromAnchorTarget(page, anchor + suffix)).toBeLessThanOrEqual(1);
    await expect(visibleMain(page).locator("[data-checkpoint-feedback]")).toHaveCount(0);
    await expect(visibleMain(page)).toContainText("0 / 54 answered");
  }
  await page.goto(path + "#" + questions[0].id);
  await expect(visibleMain(page).getByRole("button", { name: /^Vocabulary/ })).toHaveAttribute("aria-current", "step");
  await page.evaluate(a => { location.hash = a; }, reading.questions[10].id);
  await expect(visibleMain(page).getByRole("button", { name: /^Reading/ })).toHaveAttribute("aria-current", "step");
  await expect.poll(() => offsetFromAnchorTarget(page, reading.questions[10].id)).toBeLessThanOrEqual(1);
  await page.goBack();
  await expect(visibleMain(page).getByRole("button", { name: /^Vocabulary/ })).toHaveAttribute("aria-current", "step");
});
test("blank submission requires confirmation and the original result survives a fresh attempt", async ({ page }) => {
  await page.goto(path);
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await expect(visibleMain(page).getByRole("group", { name: "Confirm checkpoint submission" })).toContainText("54 questions are unanswered");
  await visibleMain(page).getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
  await expect(visibleMain(page).locator("[data-first-score]")).toContainText("0 / 54");
  await visibleMain(page).getByRole("button", { name: "Start new attempt", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Start fresh attempt", exact: true }).click();
  await expect(visibleMain(page)).toContainText("0 / 54 answered");
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  expect(saved.attempt).toBe(2); expect(saved.history).toHaveLength(1);
});
for (const width of [320, 375]) test(width + "px: all three passages and choices fit without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await visibleMain(page).getByRole("button", { name: /^Reading/ }).click();
  await expect(visibleMain(page).locator("[data-checkpoint-passage]")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const radio = visibleMain(page).locator("[data-checkpoint-question]").first().getByRole("radio").first();
  await radio.focus(); await page.keyboard.press("Space");
  await expect(radio).toBeChecked();
});
