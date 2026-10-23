import { test, expect, visibleMain } from "./fixtures";
import raw from "../src/data/checkpoint-exams.json";
import type { CheckpointExam } from "../src/types/checkpoint";
const exam = (raw as CheckpointExam[])[0];

test("a wrong workbook answer becomes a mistake card that asks the question and reveals the answer", async ({ page }) => {
  await page.goto("/chapters/11#c11-change-choices");
  const item = visibleMain(page).locator('[data-workbook-question="c11-change-choices-1"]');
  await item.locator('input[value="1"]').check();
  await item.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(visibleMain(page).locator('[data-workbook-activity="c11-change-choices"] [role="status"]')).toContainText("Saved to your mistakes deck.");
  await page.goto("/flashcards");
  const main = visibleMain(page);
  await main.getByRole("button", { name: "Mistakes only (1)" }).click();
  const card = main.locator("[data-flashcard-review]");
  await expect(card).toContainText("mistake · Question → answer");
  await expect(card.locator("h2")).toContainText("へやを（　）しました");
  await card.getByRole("button", { name: "Reveal answer" }).click();
  await expect(card.locator("[data-mistake-answer]")).toContainText("きれいに");
  await expect(card.locator("[data-mistake-answer]")).toContainText("な-adjective");
  await expect(card.getByRole("link", { name: /Chapter 11/ })).toHaveAttribute("href", "/chapters/11#c11-change-choices");
  await main.getByRole("button", { name: "English → Japanese" }).click();
  await expect(main.locator("[data-flashcard-review]")).toHaveCount(0);
});

test("a wrong answer in an older chapter's exercises is saved with its source", async ({ page }) => {
  const heading = "c1-part-d-choose-the-right-word-kono-kore-s";
  await page.goto("/chapters/1#" + heading);
  const row = visibleMain(page).locator('[data-exercise-row="' + heading + '-question-1"]');
  await row.getByText("Answer", { exact: true }).click();
  await row.getByRole("textbox").fill("それ");
  await row.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(visibleMain(page).locator('[data-legacy-exercise="' + heading + '"] [role="status"]')).toContainText("Saved to your mistakes deck.");
  const cards = await page.evaluate(() => JSON.parse(localStorage.getItem("japanese-reviewer:flashcards")!).cards);
  expect(cards).toHaveLength(1);
  expect(cards[0].kana).toContain("これ");
  expect(cards[0].sources[0]).toMatchObject({ key: "chapter:1", href: "/chapters/1#" + heading });
});

test("only wrong checkpoint answers are saved, linked to their question", async ({ page }) => {
  await page.goto("/checkpoints/" + exam.id);
  const [first, second] = exam.parts[0].questions;
  const wrong = first.choices.find(c => c.id !== first.correctChoiceId)!;
  await visibleMain(page).locator('[data-checkpoint-question="' + first.id + '"] input[value="' + wrong.id + '"]').check();
  await visibleMain(page).locator('[data-checkpoint-question="' + second.id + '"] input[value="' + second.correctChoiceId + '"]').check();
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
  await expect(visibleMain(page).locator("[data-first-score]")).toContainText("1 / 40");
  const cards = await page.evaluate(() => JSON.parse(localStorage.getItem("japanese-reviewer:flashcards")!).cards);
  expect(cards).toHaveLength(1);
  expect(cards[0].kind).toBe("mistake");
  expect(cards[0].sources[0].href).toBe("/checkpoints/" + exam.id + "#" + first.id);
});
