import { test, expect, visibleMain } from "./fixtures";
import exams from "../src/data/checkpoint-exams.json";
import display from "../src/data/chapter-5-checkpoint-display.json";
import { newCheckpointAttempt, submitCheckpointAttempt } from "../src/lib/checkpoints";
const exam = exams.find(e => e.id === "chapter-5")!;
const path = "/checkpoints/chapter-5", key = "japanese-reviewer:checkpoint:chapter-5:v1";
const aidsKey = "japanese-reviewer:reading-visibility";
const hiddenAids = JSON.stringify({ version: 2, show: { kana: false, romaji: false, english: false } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: aidsKey, value: hiddenAids });
});

test("both parts show kana directions and visible English even with all reading aids hidden", async ({ page }) => {
  await page.goto(path);
  for (const part of exam.parts) {
    await visibleMain(page).getByRole("button", { name: new RegExp("^" + part.title) }).click();
    const instructions = visibleMain(page).locator("[data-checkpoint-instructions]");
    await expect(instructions.locator('[lang="ja"]')).toBeVisible();
    await expect(instructions.locator('[lang="en"]')).toHaveText(display.instructionsEn[part.id as keyof typeof display.instructionsEn]);
    await expect(instructions.locator('[lang="en"]')).toBeVisible();
    await expect(visibleMain(page).locator("[data-checkpoint-feedback], [data-reading-hint]")).toHaveCount(0);
  }
});

test("all retained kanji have visible furigana above them before submission and in review", async ({ page }) => {
  await page.goto(path);
  for (const submitted of [false, true]) {
    if (submitted) {
      await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
      await visibleMain(page).getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
    }
    for (const part of exam.parts) {
      await visibleMain(page).getByRole("button", { name: new RegExp("^" + part.title) }).click();
      const result = await visibleMain(page).locator("[data-checkpoint-exam]").evaluate(root => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), uncovered: string[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode())
          if (/[\p{Script=Han}々]/u.test(node.textContent ?? "") && !node.parentElement?.closest("ruby")) uncovered.push(node.textContent!);
        const readings = [...root.querySelectorAll("ruby")].filter(r => r.checkVisibility()).map(ruby => {
          const rt = ruby.querySelector("rt")!, range = document.createRange();
          range.selectNodeContents(ruby.firstChild!);
          // Font bounding boxes can overlap slightly even with correct native ruby.
          // The reading's center must sit above the base text's top edge.
          const reading = rt.getBoundingClientRect(), base = range.getBoundingClientRect();
          return { text: rt.textContent, visible: rt.checkVisibility(), above: reading.top + reading.height / 2 <= base.top, position: getComputedStyle(ruby).rubyPosition };
        });
        return { uncovered, readings };
      });
      expect(result.uncovered).toEqual([]);
      expect(result.readings.length).toBeGreaterThan(0);
      for (const reading of result.readings) expect(reading).toMatchObject({ visible: true, above: true, position: "over" });
    }
  }
});

test("numeric reading clues stay numeric and do not reveal the twentieth's answer", async ({ page }) => {
  await page.goto(path);
  const question = visibleMain(page).locator('[data-checkpoint-question="chapter-5-vocabulary-27"]');
  await expect(question.locator("[data-checkpoint-prompt]")).toContainText("6/20");
  await expect(question.locator("[data-checkpoint-prompt]")).not.toContainText("はつか");
  await expect(question.locator("ruby")).toHaveCount(0);
  await expect(question.getByRole("radio")).toHaveCount(4);
});

test("existing submitted v1 attempts and first scores survive the new display", async ({ page }) => {
  const first = exam.parts[0].questions[0];
  const state = submitCheckpointAttempt(exam, { ...newCheckpointAttempt(exam), partId: "reading", answers: { [first.id]: first.correctChoiceId } }, "2026-10-21T12:00:00Z");
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key, value: JSON.stringify(state) });
  await page.goto(path);
  await expect(visibleMain(page).locator("[data-first-score]")).toHaveText("First submission: 1 / 54 · 2%");
  await expect(visibleMain(page).locator('[data-checkpoint-passage] ruby rt').first()).toHaveText("なまえ");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual(state);
});

test("Chapter 5 kana overrides leave Chapter 10 question text intact", async ({ page }) => {
  for (const id of ["vocabulary", "grammar"]) {
    await page.goto("/checkpoints/" + id);
    await expect(visibleMain(page).locator("[data-checkpoint-question]")).not.toHaveCount(0);
    await expect(visibleMain(page).locator('[data-checkpoint-instructions] [lang="en"]')).toBeVisible();
    const original = exams.find(e => e.id === id)!.parts[0];
    const instructions = await visibleMain(page).locator('[data-checkpoint-instructions] > p[lang="ja"]').evaluate(el => { const copy = el.cloneNode(true) as HTMLElement; copy.querySelectorAll("rt, rp").forEach(node => node.remove()); return copy.textContent; });
    expect(instructions).toBe(original.instructionsJa);
    expect(await visibleMain(page).locator("[data-checkpoint-prompt]").allTextContents()).toEqual(original.questions.map(q => q.prompt));
  }
});

for (const width of [320, 375]) test(width + "px: bilingual directions, furigana and radio choices fit", async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  for (const name of ["Vocabulary", "Reading"]) {
    await visibleMain(page).getByRole("button", { name: new RegExp("^" + name) }).click();
    await expect(visibleMain(page).locator('[data-checkpoint-instructions] [lang="en"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const radio = visibleMain(page).locator("[data-checkpoint-question]").first().getByRole("radio").first();
    await radio.focus(); await page.keyboard.press("Space");
    await expect(radio).toBeChecked();
    await expect(visibleMain(page).locator("ruby rt").first()).toBeVisible();
  }
});
