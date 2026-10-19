import catalog from "../src/data/japanese-display.json";
import { studyDisplay } from "../src/lib/study-markup";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, visibleMain, type Page } from "./fixtures";

// The interactive practice on chapter pages. Every test also fails on
// hydration errors and other console errors (the browserProblems fixture).

type Particle = { id: string; prompt: string; answer: string; accepted: string[]; why: string; source: { number: number } };
type Pair = { id: string; japanese: string; english: string; why: string };
type Bank = { chapters: { chapter: string; sets: ({ type: "particles"; questions: Particle[] } | { type: "vocabulary"; pairs: Pair[] })[] }[] };
const bank = JSON.parse(readFileSync(join(__dirname, "../src/data/exercises.json"), "utf8")) as Bank;
const particles = (ch: string) => (bank.chapters.find((c) => c.chapter === ch)!.sets[0] as { questions: Particle[] }).questions;
const pairs = (ch: string) => (bank.chapters.find((c) => c.chapter === ch)!.sets[1] as { pairs: Pair[] }).pairs;

test.use({ viewport: { width: 1440, height: 900 } });

const panel = (page: Page) => visibleMain(page).getByRole("region", { name: "Interactive practice" });
const answerBox = (page: Page, n: number) => panel(page).getByLabel(`Your answer for question ${n}`, { exact: true });
const checkButton = (page: Page, n: number) => panel(page).getByRole("button", { name: `Check answer ${n}`, exact: true });
const feedback = (page: Page, id: string) => panel(page).locator(`[id="${id}-feedback"]`);
const meaning = (page: Page, japanese: string) => panel(page).getByLabel("Meaning of " + studyDisplay(catalog, japanese).primary, { exact: true });

async function answerAll(page: Page, answers: string[]) {
  for (const [i, value] of answers.entries()) {
    await answerBox(page, i + 1).fill(value);
    await checkButton(page, i + 1).click();
  }
}

test("the practice sits inside Exercises, with the original tables still below", async ({ page }) => {
  await page.goto("/chapters/1");
  const exercises = visibleMain(page).locator("section#exercises");
  await expect(exercises.getByRole("region", { name: "Interactive practice" })).toBeVisible();
  await expect(exercises.locator('h3[id="c1-part-a-fill-in-the-marker-wa-no-to-ka-or"]')).toBeVisible();
  await expect(visibleMain(page).locator('h3[id="c1-part-a-fill-in-the-marker-wa-no-to-ka-or-2"]')).toBeAttached();
  const tabs = panel(page).getByRole("tab");
  await expect(tabs).toHaveText(["Particles (8)", "Vocabulary (10)"]);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

  // The source links go to the original part and its answer key
  await panel(page).getByRole("link", { name: "its answer key" }).click();
  await expect(page).toHaveURL("/chapters/1#c1-part-a-fill-in-the-marker-wa-no-to-ka-or-2");
});

test("only supported chapters get practice", async ({ page }) => {
  for (const path of ["/chapters/3", "/kana/1", "/kanji/1"]) {
    await page.goto(path);
    await expect(visibleMain(page).locator(".lesson").first()).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
  }
});

test("particles: romaji and kana, feedback with the source explanation, blanks and edits", async ({ page }) => {
  await page.goto("/chapters/1");
  const [q1, q2] = particles("1");

  await answerBox(page, 1).fill("WA");
  await checkButton(page, 1).click();
  await expect(feedback(page, q1.id)).toContainText("Correct");
  await expect(feedback(page, q1.id)).toContainText(`Answer: ${studyDisplay(catalog, q1.answer).primary}`);
  await expect(feedback(page, q1.id)).toContainText(studyDisplay(catalog, q1.why).primary);
  await expect(answerBox(page, 1)).toHaveAttribute("readonly", "");

  await answerBox(page, 2).fill("は"); // wa in kana, but the answer is no
  await checkButton(page, 2).click();
  await expect(feedback(page, q2.id)).toContainText("Incorrect");
  await expect(feedback(page, q2.id)).toContainText("You wrote “は”");
  await expect(feedback(page, q2.id)).toContainText(`Answer: ${studyDisplay(catalog, q2.answer).primary}`);
  await expect(answerBox(page, 2)).toHaveAttribute("aria-invalid", "true");

  // Editing a checked answer hides the old grade until it's checked again
  await answerBox(page, 2).fill("の");
  await expect(feedback(page, q2.id)).toBeEmpty();
  await checkButton(page, 2).click();
  await expect(feedback(page, q2.id)).toContainText("Correct");

  // Blank: a helpful message, no grade
  await answerBox(page, 3).fill("   ");
  await checkButton(page, 3).click();
  await expect(feedback(page, particles("1")[2].id)).toHaveText(/Type a particle first/);
  await expect(feedback(page, particles("1")[2].id)).not.toContainText("Incorrect");
  await expect(answerBox(page, 3)).toBeFocused();
  await expect(panel(page)).toContainText("Not checked yet6");
});

test("particles: わ isn't wa, and chapter 2 question 7 accepts ni wa", async ({ page }) => {
  await page.goto("/chapters/1");
  await answerBox(page, 1).fill("わ");
  await checkButton(page, 1).click();
  await expect(feedback(page, "c1-particles-1")).toContainText("Incorrect");

  await page.goto("/chapters/2");
  await answerBox(page, 7).fill("ni  wa");
  await checkButton(page, 7).click();
  await expect(feedback(page, "c2-particles-7")).toContainText("Correct");
  await expect(panel(page).locator('[id="c2-particles-7-prompt"]')).toContainText("には");
  await expect(feedback(page, "c2-particles-7")).toContainText("You may also say りょう に は for emphasis.");
});

test("particles: Enter checks, but not while an IME is composing", async ({ page }) => {
  await page.goto("/chapters/1");
  const box = answerBox(page, 1);
  await box.fill("は");
  // The Enter that confirms a conversion arrives with isComposing (keyCode 229 in Safari)
  await box.evaluate((el) => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true }));
  });
  await expect(feedback(page, "c1-particles-1")).toBeEmpty();
  await box.press("Enter");
  await expect(feedback(page, "c1-particles-1")).toContainText("Correct");
});

test("particles: retry only the incorrect ones, keep the first score, then restart", async ({ page }) => {
  await page.goto("/chapters/1");
  const qs = particles("1");
  // Questions 2 and 5 wrong, the rest right
  const answers = qs.map((q, i) => (i === 1 || i === 4 ? "ga" : q.accepted[i % 2]));
  await answerAll(page, answers);

  const results = panel(page).getByRole("tabpanel").first();
  await expect(results).toContainText("First try: 6 of 8 correct");
  const retry = results.getByRole("button", { name: "Retry incorrect (2)" });
  await retry.click();

  // Only questions 2 and 5 are cleared, editable and without their old feedback
  await expect(answerBox(page, 2)).toBeFocused();
  for (const n of [2, 5]) {
    await expect(answerBox(page, n)).toHaveValue("");
    await expect(answerBox(page, n)).not.toHaveAttribute("readonly");
    await expect(feedback(page, qs[n - 1].id)).toBeEmpty();
  }
  for (const n of [1, 3, 4, 6, 7, 8]) {
    await expect(answerBox(page, n)).toHaveValue(answers[n - 1]);
    await expect(feedback(page, qs[n - 1].id)).toContainText("Correct");
  }
  await expect(results).toContainText("First try: 6 of 8 correct");
  await expect(results).toContainText("After retrying: 6 of 8 correct, 2 still to check");

  await answerBox(page, 2).fill(qs[1].accepted[0]);
  await answerBox(page, 2).press("Enter");
  await answerBox(page, 5).fill(qs[4].accepted[1]);
  await answerBox(page, 5).press("Enter");
  await expect(results).toContainText("All 8 questions correct. Practice complete.");
  await expect(results).toContainText("First try: 6 of 8 correct"); // still the original score
  await expect(results).toContainText("After retrying: 8 of 8 correct");
  await expect(results.getByRole("button", { name: /Retry incorrect/ })).toHaveCount(0);

  await results.getByRole("button", { name: "Restart practice" }).click();
  await expect(answerBox(page, 1)).toBeFocused();
  for (let n = 1; n <= 8; n++) await expect(answerBox(page, n)).toHaveValue("");
  await expect(results).not.toContainText("First try");
  await expect(results).toContainText("Not checked yet8");
});

test("retry stays off until every question is checked", async ({ page }) => {
  await page.goto("/chapters/1");
  await answerBox(page, 1).fill("ga");
  await checkButton(page, 1).click();
  const retry = panel(page).getByRole("button", { name: "Retry incorrect (1)" });
  await expect(retry).toBeDisabled();
  await expect(panel(page)).toContainText("Check the remaining 7 questions to retry the incorrect ones.");
});

test("vocabulary: keyboard tabs, matching by menu, retries keep every choice available", async ({ page }) => {
  await page.goto("/chapters/2");
  const tabs = panel(page).getByRole("tab");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  const vocab = panel(page).getByRole("tabpanel", { name: /Vocabulary/ });
  await expect(vocab).toBeVisible();
  await expect(vocab.getByRole("group", { name: "Round 1 of 2" })).toBeVisible();
  await expect(vocab.getByRole("group", { name: "Round 2 of 2" })).toBeVisible();

  const ps = pairs("2");
  const firstMenu = meaning(page, ps[0].japanese);
  // Five meanings per round plus the prompt, in a shuffled order that stays put
  const order = await firstMenu.locator("option").allTextContents();
  expect(order).toHaveLength(6);
  expect(order.slice(1).sort()).toEqual(ps.slice(0, 5).map((p) => p.english).sort());

  // Nothing chosen: a helpful message
  await vocab.getByRole("button", { name: "Check answers" }).click();
  await expect(vocab).toContainText("Choose a meaning for at least one word, then check.");

  // Round 1 right, except the first two swapped; round 2 left blank
  await firstMenu.selectOption({ label: ps[1].english });
  await meaning(page, ps[1].japanese).selectOption({ label: ps[0].english });
  for (const p of ps.slice(2, 5)) await meaning(page, p.japanese).selectOption({ label: p.english });
  await vocab.getByRole("button", { name: "Check answers" }).click();
  await expect(vocab).toContainText("5 words still need a meaning.");
  await expect(feedback(page, ps[0].id)).toContainText("Incorrect");
  await expect(feedback(page, ps[0].id)).toContainText(studyDisplay(catalog, ps[0].why).primary);
  await expect(feedback(page, ps[2].id)).toContainText("Correct");
  await expect(feedback(page, ps[2].id)).toContainText(studyDisplay(catalog, ps[2].why).primary);
  await expect(vocab.getByRole("button", { name: "Retry incorrect (2)" })).toBeDisabled();

  // Round 2: all right, so the whole set is checked
  for (const p of ps.slice(5)) await meaning(page, p.japanese).selectOption({ label: p.english });
  await vocab.getByRole("button", { name: "Check answers" }).click();
  await expect(vocab).toContainText("First try: 8 of 10 correct");

  await vocab.getByRole("button", { name: "Retry incorrect (2)" }).click();
  await expect(firstMenu).toBeFocused();
  await expect(firstMenu).toHaveValue("");
  await expect(feedback(page, ps[0].id)).toBeEmpty();
  // Same order, and still all five meanings, including the ones already matched
  expect(await firstMenu.locator("option").allTextContents()).toEqual(order);
  // Matched words show their meaning as text and can't be changed
  await expect(meaning(page, ps[2].japanese)).toHaveCount(0);
  await expect(vocab.locator(`[id="${ps[2].id}-select"]`)).toHaveText(ps[2].english);

  await firstMenu.selectOption({ label: ps[0].english });
  await meaning(page, ps[1].japanese).selectOption({ label: ps[1].english });
  await vocab.getByRole("button", { name: "Check answers" }).click();
  await expect(vocab).toContainText("All 10 words correct. Practice complete.");
  await expect(vocab).toContainText("First try: 8 of 10 correct");
  await expect(vocab.getByRole("button", { name: "Check answers" })).toHaveCount(0);

  // Restart: every menu is back and empty
  await vocab.getByRole("button", { name: "Restart practice" }).click();
  await expect(firstMenu).toBeFocused();
  for (const p of ps) await expect(meaning(page, p.japanese)).toHaveValue("");
});

test("each chapter keeps its own answers", async ({ page }) => {
  await page.goto("/chapters/1");
  await answerBox(page, 1).fill("wa");
  await checkButton(page, 1).click();
  await expect(feedback(page, "c1-particles-1")).toContainText("Correct");

  // Next chapter, through the page's own link (client-side navigation)
  await visibleMain(page).getByRole("navigation", { name: "Chapter pages" }).getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL("/chapters/2");
  await expect(answerBox(page, 1)).toHaveValue("");
  await expect(feedback(page, "c2-particles-1")).toBeEmpty();
  await expect(panel(page).locator('[id^="c1-"]')).toHaveCount(0);
  await expect(panel(page).locator('[id="c2-particles-1-prompt"]')).toContainText(studyDisplay(catalog, particles("2")[0].prompt).primary.split("____")[0].trim());
});

test("phone: the practice fits and stays usable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/chapters/1#exercises");
  await answerBox(page, 1).fill("wa");
  await checkButton(page, 1).click();
  await expect(feedback(page, "c1-particles-1")).toContainText("Correct");
  const overflow = await panel(page).evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(false);
  await panel(page).getByRole("tab", { name: /Vocabulary/ }).click();
  await meaning(page, pairs("1")[0].japanese).selectOption({ label: pairs("1")[0].english });
  await expect(meaning(page, pairs("1")[0].japanese)).toHaveValue(pairs("1")[0].id);
});
