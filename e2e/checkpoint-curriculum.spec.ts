import { test, expect, visibleMain } from "./fixtures";
import exams from "../src/data/checkpoint-exams.json";
import previous from "../migration/checkpoint-v1-archive.json";
import { checkpointKey, newCheckpointAttempt, submitCheckpointAttempt } from "../src/lib/checkpoints";

for (const exam of exams.filter(e => e.id !== "chapter-5")) {
  test(exam.id + ": revised questions start independently and never overwrite the old assessment", async ({ page }) => {
    const old = previous.exams.find(e => e.id === exam.id)!;
    const oldFirst = old.parts[0].questions[0];
    const oldState = submitCheckpointAttempt(old, { ...newCheckpointAttempt(old), answers: { [oldFirst.id]: oldFirst.correctChoiceId } }, "2026-10-21T12:00:00Z");
    const oldKey = checkpointKey(old), raw = JSON.stringify(oldState);
    await page.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, value); }, { key: oldKey, value: raw });
    await page.goto("/checkpoints/" + exam.id);
    await expect(visibleMain(page)).toContainText("0 / 40 answered");
    await expect(visibleMain(page).locator("[data-first-score]")).toHaveCount(0);
    await expect(visibleMain(page).locator("[data-checkpoint-revision]")).toContainText("Earlier versions stay saved separately");
    const first = exam.parts[0].questions[0];
    const input = visibleMain(page).locator('[data-checkpoint-question="' + first.id + '"] input[value="' + first.correctChoiceId + '"]');
    await input.check();
    await page.reload();
    await expect(input).toBeChecked();
    await expect(visibleMain(page)).toContainText("1 / 40 answered");
    expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBe(raw);
    const current = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), checkpointKey(exam));
    expect(current.examRevision).toBe(2);
    expect(current.history).toEqual([]);
  });
}

test("vocabulary: Kanji 1 spellings stay bare and the 24 context questions use kana", async ({ page }) => {
  await page.goto("/checkpoints/vocabulary");
  const main = visibleMain(page);
  const prompts = main.locator("[data-checkpoint-prompt]");
  await expect(prompts).toHaveText(["【日本】の よみかたは どれですか。", "【母】の よみかたは どれですか。", "【三百】の よみかたは どれですか。", "【火よう日】の よみかたは どれですか。"]);
  await expect(main.locator("[data-checkpoint-question] ruby")).toHaveCount(0);
  await main.getByRole("button", { name: /^Written forms/ }).click();
  await expect(main.locator("[data-checkpoint-question]")).toHaveCount(4);
  await expect(main.locator("[data-checkpoint-question] ruby")).toHaveCount(0);
  await main.getByRole("button", { name: /^Words in context/ }).click();
  await expect(main.locator("[data-checkpoint-question]")).toHaveCount(24);
  const text = await main.locator("[data-checkpoint-question] fieldset").allTextContents();
  expect(text.every(t => !/[\p{Script=Han}々]/u.test(t))).toBe(true);
  await expect(main.locator('[data-checkpoint-instructions] [lang="en"]')).toBeVisible();
  await main.getByRole("button", { name: /^Kanji readings/ }).click();
  await expect(main.getByRole("link", { name: "Review Kanji 1", exact: true })).toHaveCount(0);
  await main.getByRole("button", { name: "Submit exam", exact: true }).click();
  await main.getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
  await expect(main.locator('[data-checkpoint-question="vocabulary-1"]').getByRole("link", { name: "Review Kanji 1", exact: true })).toHaveAttribute("href", "/kanji/1#c1-sun-day");
});

test("grammar: plain negative tasks give explicit meaning cues and the new keys work after checking", async ({ page }) => {
  const exam = exams.find(e => e.id === "grammar")!;
  await page.goto("/checkpoints/grammar");
  const main = visibleMain(page);
  await main.getByRole("button", { name: /^Grammar in context/ }).click();
  for (const number of [35, 39, 40]) {
    const question = exam.parts.flatMap(p => p.questions).find(q => q.number === number)!;
    await main.locator('[data-checkpoint-question="' + question.id + '"] input[value="' + question.correctChoiceId + '"]').check();
  }
  await expect(main.locator('[data-checkpoint-question="grammar-39"]')).toContainText("たべません");
  await expect(main.locator('[data-checkpoint-question="grammar-40"]')).toContainText("しませんでした");
  await main.getByRole("button", { name: "Submit exam", exact: true }).click();
  await main.getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
  await expect(main.locator("[data-first-score]")).toHaveText("First submission: 3 / 40 · 8%");
  for (const number of [35, 39, 40]) await expect(main.locator('[data-checkpoint-question="grammar-' + number + '"] [data-checkpoint-feedback]')).toContainText("Correct");
});
