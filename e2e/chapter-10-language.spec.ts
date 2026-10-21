import { test, expect, visibleMain } from "./fixtures";
import exams from "../src/data/checkpoint-exams.json";
import kanji from "../src/data/kanji.json";
import policy from "../src/data/chapter-10-checkpoint-display.json";
import { buildChapter10Presentation, kanji1Characters } from "../src/lib/chapter-10-checkpoint";
import { newCheckpointAttempt, submitCheckpointAttempt } from "../src/lib/checkpoints";

const chapter10 = exams.filter(exam => exam.id !== "chapter-5");
const path = (id: string) => "/checkpoints/" + id;
const key = (id: string) => "japanese-reviewer:checkpoint:" + id + ":v" + exams.find(exam => exam.id === id)!.revision;
const known = kanji1Characters(kanji[0]);
const hiddenAids = JSON.stringify({ version: 2, show: { kana: false, romaji: false, english: false } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(value => localStorage.setItem("japanese-reviewer:reading-visibility", value), hiddenAids);
});

for (const exam of chapter10) {
  test(exam.id + ": every part has permanent instruction furigana and visible English", async ({ page }) => {
    const config = policy.exams[exam.id as keyof typeof policy.exams];
    await page.goto(path(exam.id));
    for (const part of exam.parts) {
      await visibleMain(page).getByRole("button", { name: new RegExp("^" + part.title) }).click();
      await expect(visibleMain(page).locator('[data-checkpoint-instructions] [lang="en"]')).toHaveText(config.instructionsEn[part.id as keyof typeof config.instructionsEn]);
      await expect(visibleMain(page).locator('[data-checkpoint-instructions] [lang="en"]')).toBeVisible();
      const result = await visibleMain(page).locator("#checkpoint-part-heading, [data-checkpoint-instructions]").evaluateAll(elements => {
        const uncovered: string[] = [], readings: boolean[] = [];
        for (const element of elements) {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode())
            if (/[\p{Script=Han}々]/u.test(node.textContent ?? "") && !node.parentElement?.closest("ruby")) uncovered.push(node.textContent!);
          for (const ruby of element.querySelectorAll("ruby")) {
            const rt = ruby.querySelector("rt")!, range = document.createRange(); range.selectNodeContents(ruby.firstChild!);
            const r = rt.getBoundingClientRect(), base = range.getBoundingClientRect();
            readings.push(rt.checkVisibility() && r.top + r.height / 2 <= base.top && getComputedStyle(ruby).rubyPosition === "over");
          }
        }
        return { uncovered, readings };
      });
      expect(result.uncovered).toEqual([]);
      expect(result.readings.length).toBeGreaterThan(0);
      expect(result.readings.every(Boolean)).toBe(true);
    }
  });

  test(exam.id + ": all 40 items render their source prompts and choices with the prepared first-use readings", async ({ page }) => {
    const prepared = buildChapter10Presentation(exam, policy, known).prepared!;
    await page.goto(path(exam.id));
    for (const part of exam.parts) {
      await visibleMain(page).getByRole("button", { name: new RegExp("^" + part.title) }).click();
      const actual = await visibleMain(page).locator("[data-checkpoint-question]").evaluateAll(elements => elements.map(element => {
        const base = (node: Element) => { const copy = node.cloneNode(true) as HTMLElement; copy.querySelectorAll("rt, rp").forEach(n => n.remove()); return copy.textContent ?? ""; };
        return {
          id: element.getAttribute("data-checkpoint-question"), prompt: base(element.querySelector("[data-checkpoint-prompt]")!),
          choices: [...element.querySelectorAll('label span[lang="ja"]')].map(node => base(node).replace(/^\s*[1-4]\.\s*/, "").trim()),
          readings: [...element.querySelectorAll("ruby")].map(node => [node.firstChild!.textContent, node.querySelector("rt")!.textContent]),
        };
      }));
      expect(actual).toEqual(part.questions.map(question => {
        const item = prepared.questions[question.id];
        const fields = [...(item.passage ?? []), ...(item.context ?? []), ...item.prompt,
          ...(item.composition?.before ?? []), ...(item.composition?.after ?? []), ...Object.values(item.choices).flat()];
        return { id: question.id, prompt: question.prompt, choices: question.choices.map(c => c.text), readings: fields.filter(p => p.reading).map(p => [p.text, p.reading]) };
      }));
    }
  });

  test(exam.id + ": current-version first scores and history survive reloads", async ({ page }) => {
    const first = exam.parts[0].questions[0];
    const state = submitCheckpointAttempt(exam, { ...newCheckpointAttempt(exam), answers: { [first.id]: first.correctChoiceId } }, "2026-10-21T12:00:00Z");
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: key(exam.id), value: JSON.stringify(state) });
    await page.goto(path(exam.id));
    await expect(visibleMain(page).locator("[data-first-score]")).toHaveText("First submission: 1 / 40 · 3%");
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key(exam.id))).toEqual(state);
    await expect(visibleMain(page).locator("[data-checkpoint-feedback]")).toHaveCount(exam.parts[0].questions.length);
  });
}

test("all four tested Kanji 1 reading targets stay bare before submission and throughout review", async ({ page }) => {
  await page.goto(path("vocabulary"));
  await expect(visibleMain(page).locator("[data-checkpoint-question]")).toHaveCount(4);
  await expect(visibleMain(page).locator("[data-checkpoint-question] ruby")).toHaveCount(0);
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
  await expect(visibleMain(page).locator("[data-checkpoint-feedback]")).toHaveCount(4);
  await expect(visibleMain(page).locator("[data-checkpoint-question] ruby")).toHaveCount(0);
});

test("written-form choices never get answer-revealing furigana", async ({ page }) => {
  await page.goto(path("vocabulary"));
  await visibleMain(page).getByRole("button", { name: /^Written forms/ }).click();
  await expect(visibleMain(page).locator("[data-checkpoint-question]")).toHaveCount(4);
  await expect(visibleMain(page).locator("[data-checkpoint-question] label")).toHaveCount(16);
  await expect(visibleMain(page).locator("[data-checkpoint-question] ruby")).toHaveCount(0);
});

test("first-use readings stay stable through choices, part changes and reloads", async ({ page }) => {
  await page.goto(path("grammar"));
  const tab = visibleMain(page).getByRole("button", { name: /^Sentence composition/ });
  await tab.click();
  const first = visibleMain(page).locator('[data-checkpoint-question="grammar-25"]');
  await expect(first.locator("ruby rt")).toHaveText(["はい"]);
  await first.getByRole("radio").first().check();
  await expect(first.locator("ruby rt")).toHaveText(["はい"]);
  await visibleMain(page).getByRole("button", { name: /^Grammar choices/ }).click();
  await tab.click();
  await expect(first.locator("ruby rt")).toHaveText(["はい"]);
  await page.reload();
  await expect(first.locator("ruby rt")).toHaveText(["はい"]);
  await expect(first.getByRole("radio").first()).toBeChecked();
});

for (const width of [320, 375]) test(width + "px: bilingual instructions, ruby and sentence slots fit", async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path("grammar"));
  await visibleMain(page).getByRole("button", { name: /^Sentence composition/ }).click();
  await expect(visibleMain(page).locator('[data-checkpoint-instructions] [lang="en"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const first = visibleMain(page).locator("[data-checkpoint-question]").first();
  const radio = first.getByRole("radio").first(); await radio.focus(); await page.keyboard.press("Space");
  await expect(radio).toBeChecked(); await expect(first.locator("ruby rt")).toBeVisible();
});
