import { test, expect, visibleMain, type Page } from "./fixtures";
import exams from "../src/data/checkpoint-exams.json";
const path = (id: string) => "/checkpoints/" + id;
const key = (id: string) => "japanese-reviewer:checkpoint:" + id + ":v1";
const q = (page: Page, id: string) => visibleMain(page).locator('[data-checkpoint-question="' + id + '"]');
const choosePart = (page: Page, title: string) => visibleMain(page).getByRole("navigation", { name: "Checkpoint parts" }).getByRole("button", { name: new RegExp("^" + title) }).click();
async function answerAll(page: Page, exam: typeof exams[number], firstWrong = false) {
  for (const part of exam.parts) {
    await choosePart(page, part.title);
    for (const question of part.questions) {
      const answer = firstWrong && question.number === 1 ? question.choices.find(c => c.id !== question.correctChoiceId)!.id : question.correctChoiceId;
      await q(page, question.id).locator('input[value="' + answer + '"]').check();
    }
  }
}
test("the home page and navigation offer three checkpoints grouped by course stage", async ({ page }) => {
  await page.goto("/");
  const shelf = visibleMain(page).locator("#checkpoints");
  await expect(shelf.getByRole("link", { name: /^Vocabulary checkpoint/ })).toHaveCount(1);
  await expect(shelf.getByRole("link", { name: /^Grammar checkpoint/ })).toHaveCount(1);
  await page.locator("aside").first().getByRole("link", { name: "Checkpoints", exact: true }).click();
  await expect(page).toHaveURL("/checkpoints");
  await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText("Course checkpoints");
  await expect(visibleMain(page)).toContainText("28 focus on Chapters 6–10");
  await expect(page.locator("aside").first().getByRole("link", { name: "Checkpoints", exact: true })).toHaveAttribute("aria-current", "true");
});
test("Chapter 10 links to both exams; earlier chapter readers stay unchanged", async ({ page }) => {
  await page.goto("/chapters/10");
  const section = visibleMain(page).locator("section").filter({ has: page.getByRole("heading", { name: "Ready for your checkpoint?" }) });
  await expect(section.getByRole("link", { name: "Vocabulary checkpoint", exact: true })).toHaveAttribute("href", path("vocabulary"));
  await section.getByRole("link", { name: "Grammar checkpoint", exact: true }).click();
  await expect(page).toHaveURL(path("grammar"));
  await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText("Grammar checkpoint");
  await page.goto("/chapters/9");
  await expect(visibleMain(page).getByRole("heading", { name: "Ready for your checkpoint?" })).toHaveCount(0);
});
test("saved answers and active part survive reload and remain separate between exams", async ({ page }) => {
  const exam = exams[0], first = exam.parts[0].questions[0], second = exam.parts[1].questions[0];
  await page.goto(path(exam.id));
  await q(page, first.id).locator('input[value="1"]').check();
  await choosePart(page, exam.parts[1].title);
  await q(page, second.id).locator('input[value="2"]').check();
  await page.reload();
  await expect(q(page, second.id).locator('input[value="2"]')).toBeChecked();
  await page.goto(path("grammar"));
  await expect(visibleMain(page)).toContainText("0 / 40 answered");
  await page.goto(path(exam.id));
  await expect(q(page, second.id).locator('input[value="2"]')).toBeChecked();
  await choosePart(page, exam.parts[0].title);
  await expect(q(page, first.id).locator('input[value="1"]')).toBeChecked();
});
for (const exam of exams.filter(exam => exam.id !== "chapter-5")) {
  test(exam.id + ": Japanese questions have no translation hints or feedback before submission", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("japanese-reviewer:reading-visibility", JSON.stringify({ version: 2, show: { kana: true, romaji: true, english: true } })));
    await page.goto(path(exam.id));
    for (const part of exam.parts) {
      await choosePart(page, part.title);
      await expect(visibleMain(page).locator("[data-checkpoint-question]")).toHaveCount(part.questions.length);
      const prompts = await visibleMain(page).locator("[data-checkpoint-prompt]").allTextContents();
      expect(prompts.every(p => !/[A-Za-z]/.test(p))).toBe(true);
      await expect(visibleMain(page).locator("[data-reading-hint]")).toHaveCount(0);
      await expect(visibleMain(page).locator("[data-checkpoint-feedback]")).toHaveCount(0);
      await expect(visibleMain(page).locator("[data-chapter-results]")).toHaveCount(0);
    }
  });
  test(exam.id + ": scores, review links and retries preserve the original assessment", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("japanese-reviewer:reading-visibility", JSON.stringify({ version: 2, show: { kana: true, romaji: false, english: false } })));
    await page.goto(path(exam.id));
    await answerAll(page, exam, true);
    await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
    await expect(visibleMain(page).getByText("Result: 39 / 40 correct", { exact: true })).toBeVisible();
    await expect(visibleMain(page).locator("[data-first-score]")).toHaveText("First submission: 39 / 40 · 98%");
    await expect(visibleMain(page).locator("[data-chapter-results] > li")).toHaveCount(10);
    await choosePart(page, exam.parts[0].title);
    const first = exam.parts[0].questions[0], second = exam.parts[0].questions[1];
    await expect(q(page, first.id).locator("[data-checkpoint-feedback]")).toContainText("Incorrect");
    await expect(q(page, first.id).getByRole("link", { name: /^Review Chapter/ })).toHaveAttribute("href", "/chapters/" + first.chapter + "#" + first.source.heading);
    const hint = q(page, first.id).locator("[data-reading-hint=english] > span[id]");
    await expect(hint).toBeHidden();
    await q(page, first.id).getByRole("button", { name: /^Reveal English for/ }).click();
    await expect(hint).toBeVisible();
    await visibleMain(page).getByRole("button", { name: "Retry incorrect", exact: true }).click();
    await expect(q(page, first.id).locator("input:checked")).toHaveCount(0);
    await expect(q(page, second.id).locator('input[value="' + second.correctChoiceId + '"]')).toBeDisabled();
    await q(page, first.id).locator('input[value="' + first.correctChoiceId + '"]').check();
    await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
    await expect(visibleMain(page).locator("[data-practice-score]")).toHaveText("Practice result: 40 / 40 · 100%");
    await expect(visibleMain(page).locator("[data-first-score]")).toHaveText("First submission: 39 / 40 · 98%");
    const state = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key(exam.id));
    expect(state.history).toHaveLength(1); expect(state.history[0].correct).toBe(39);
    await page.reload();
    await expect(visibleMain(page).locator("[data-first-score]")).toContainText("39 / 40");
  });
}
test("incomplete submission and a fresh attempt require confirmation; history survives restarting", async ({ page }) => {
  const exam = exams[0], first = exam.parts[0].questions[0];
  await page.goto(path(exam.id));
  await q(page, first.id).locator('input[value="' + first.correctChoiceId + '"]').check();
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await expect(visibleMain(page).getByRole("group", { name: "Confirm checkpoint submission" })).toContainText("39 questions are unanswered");
  await visibleMain(page).getByRole("button", { name: "Keep answering", exact: true }).click();
  await expect(visibleMain(page).locator("[data-first-score]")).toHaveCount(0);
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
  await expect(visibleMain(page).locator("[data-first-score]")).toContainText("1 / 40");
  await visibleMain(page).getByRole("button", { name: "Start new attempt", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Keep this attempt", exact: true }).click();
  await expect(q(page, first.id).locator("input:checked")).toHaveCount(1);
  await visibleMain(page).getByRole("button", { name: "Start new attempt", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Start fresh attempt", exact: true }).click();
  await expect(visibleMain(page)).toContainText("0 / 40 answered");
  await expect(visibleMain(page).locator("[data-first-score]")).toHaveCount(0);
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
  const state = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key(exam.id));
  expect(state.history.map((h: { correct: number }) => h.correct)).toEqual([1, 0]);
  await visibleMain(page).locator("summary").click();
  await expect(visibleMain(page).locator("[data-checkpoint-history] > li")).toHaveCount(2);
});
test("starred composition and paired text questions retain their context", async ({ page }) => {
  const exam = exams[1];
  await page.goto(path(exam.id));
  await choosePart(page, exam.parts[1].title);
  await expect(visibleMain(page).getByLabel("Sentence to arrange")).toHaveCount(8);
  const order = exam.parts[1].questions[0];
  await expect(q(page, order.id)).toContainText("★");
  await q(page, order.id).locator('input[value="' + order.correctChoiceId + '"]').check();
  await choosePart(page, exam.parts[2].title);
  await expect(visibleMain(page).locator("[data-checkpoint-passage]")).toHaveCount(4);
  const text = exam.parts[2].questions[1];
  await q(page, text.id).locator('input[value="' + text.correctChoiceId + '"]').check();
  await page.reload();
  await expect(q(page, text.id).locator('input[value="' + text.correctChoiceId + '"]')).toBeChecked();
  await expect(q(page, text.id).locator("fieldset")).toHaveAttribute("aria-describedby", "checkpoint-prompt-" + text.id + " checkpoint-passage-outing");
});
test("blocked storage retains answers in the open tab", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, value) { if (k.startsWith("japanese-reviewer:checkpoint:")) throw new DOMException("blocked", "SecurityError"); return original.call(this, k, value); };
  });
  await page.goto(path("vocabulary"));
  const first = exams[0].parts[0].questions[0];
  await q(page, first.id).locator('input[value="1"]').check();
  await expect(visibleMain(page)).toContainText("This browser cannot save your answers");
  await choosePart(page, exams[0].parts[1].title); await choosePart(page, exams[0].parts[0].title);
  await expect(q(page, first.id).locator('input[value="1"]')).toBeChecked();
});
test("damaged stored attempts recover to an empty assessment", async ({ page }) => {
  await page.addInitScript(k => localStorage.setItem(k, "{broken"), key("vocabulary"));
  await page.goto(path("vocabulary"));
  await expect(visibleMain(page)).toContainText("0 / 40 answered");
  await expect(visibleMain(page).locator("[data-first-score]")).toHaveCount(0);
});
test("the exam synchronizes answers from another open tab", async ({ page, context }) => {
  const first = exams[0].parts[0].questions[0];
  await page.goto(path("vocabulary"));
  const other = await context.newPage();
  await other.goto(path("vocabulary"));
  await q(other, first.id).locator('input[value="2"]').check();
  await expect(q(page, first.id).locator('input[value="2"]')).toBeChecked();
  await other.close();
});
for (const width of [320, 375]) {
  test(width + "px: phone menu, every question type and radio choices fit", async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.locator("#mobile-nav").getByRole("link", { name: "Checkpoints", exact: true }).click();
    await expect(page).toHaveURL("/checkpoints");
    await expect(page.locator("#mobile-nav")).toBeHidden();
    for (const exam of exams) {
      await page.goto(path(exam.id));
      for (const part of exam.parts) {
        await choosePart(page, part.title);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const radio = visibleMain(page).locator("[data-checkpoint-question]").first().locator("label").first();
        expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await visibleMain(page).locator("[data-checkpoint-question]").first().screenshot({ path: testInfo.outputPath("checkpoint-phone.png") });
  });
}
test("answer options support native keyboard selection", async ({ page }) => {
  await page.goto(path("vocabulary"));
  const first = q(page, exams[0].parts[0].questions[0].id), radios = first.getByRole("radio");
  await radios.nth(0).focus(); await page.keyboard.press("Space");
  await expect(radios.nth(0)).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(1)).toBeChecked();
});
test.describe("missing checkpoints", () => {
  test.use({ allowedStatuses: [404] });
  test("unknown exams render the not-found page", async ({ page }) => {
    const response = await page.goto("/checkpoints/unknown");
    expect([200, 404]).toContain(response!.status());
    await expect(visibleMain(page).getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  });
});
