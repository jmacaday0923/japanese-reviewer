import { test, expect, visibleMain, type Page } from "./fixtures";
import raw from "../src/data/listening-exams.json";
const exam = raw[0];
const route = "/listening/" + exam.id;
const storageKey = "japanese-reviewer:listening:" + exam.id + ":v" + exam.revision;
const question = (page: Page, id: string) => visibleMain(page).locator(`[data-listening-question="${id}"]`);
const part = (page: Page, number: number) => visibleMain(page).getByRole("navigation", { name: "Listening parts" }).getByRole("button", { name: new RegExp("^もんだい " + number + " ") });
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey);
async function answerAll(page: Page, firstWrong = false) {
  for (const section of exam.sections) {
    await part(page, section.number).click();
    for (const q of section.questions) {
      const choice = firstWrong && q.id === exam.sections[0].questions[0].id ? "2" : q.correctChoiceId;
      await question(page, q.id).locator(`input[value="${choice}"]`).check();
    }
  }
}

test("dashboard and sidebar lead to the new listening exam", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(visibleMain(page).locator("#listening").getByRole("heading", { name: "Listening", exact: true })).toBeVisible();
  await page.locator("aside").first().getByRole("link", { name: "Listening", exact: true }).click();
  await expect(page).toHaveURL("/listening");
  await visibleMain(page).locator("#listening").getByRole("link", { name: /^N5 listening/ }).click();
  await expect(page).toHaveURL(route);
  await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText(exam.title);
  await expect(page.locator("aside").first().getByRole("link", { name: "Listening", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(visibleMain(page).locator("[data-listening-question]")).toHaveCount(7);
  await expect(visibleMain(page).locator("[data-listening-feedback]")).toHaveCount(0);
});

test("all four real audio files support byte-range requests for seeking", async ({ request }) => {
  for (const section of exam.sections) {
    const response = await request.get(section.audioSrc, { headers: { Range: "bytes=0-511" } });
    expect(response.status()).toBe(206);
    expect(response.headers()["content-range"]).toMatch(/^bytes 0-511\//);
    expect((await response.body()).length).toBe(512);
  }
});

test("only the active audio exists; playback pauses on part changes and starts without autoplay", async ({ page }) => {
  await page.goto(route);
  const audio = visibleMain(page).locator("audio");
  await expect(audio).toHaveCount(1);
  await expect(audio).toHaveAttribute("preload", "none");
  expect(await audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  await visibleMain(page).getByRole("heading", { level: 1 }).click();
  await audio.evaluate((el: HTMLAudioElement) => el.play());
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
  const duration = await audio.evaluate((el: HTMLAudioElement) => el.duration);
  expect(Math.abs(duration - exam.sections[0].audioDurationSeconds)).toBeLessThan(1);
  await part(page, 2).click();
  await expect(audio).toHaveCount(1);
  await expect(audio).toHaveAttribute("src", exam.sections[1].audioSrc);
  expect(await audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
});

test("answers and selected part persist when switching and reloading", async ({ page }) => {
  await page.goto(route);
  const first = exam.sections[0].questions[0];
  await question(page, first.id).getByRole("radio", { name: "1", exact: true }).check();
  await part(page, 2).click();
  const next = exam.sections[1].questions[0];
  await question(page, next.id).locator('input[value="3"]').check();
  await page.reload();
  await expect(part(page, 2)).toHaveAttribute("aria-current", "step");
  await expect(question(page, next.id).locator('input[value="3"]')).toBeChecked();
  await part(page, 1).click();
  await expect(question(page, first.id).getByRole("radio", { name: "1", exact: true })).toBeChecked();
  expect((await saved(page)).answers).toEqual({ [first.id]: "1", [next.id]: "3" });
});

test("submission scores the exam; retry keeps correct answers and the first score", async ({ page }) => {
  await page.goto(route);
  await answerAll(page, true);
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await expect(visibleMain(page).getByText("Result: 23 / 24 correct", { exact: true })).toBeVisible();
  await expect(visibleMain(page)).toContainText("Generated practice answer key");
  await expect(visibleMain(page).locator("input[type=radio]").first()).toBeDisabled();
  await visibleMain(page).getByRole("button", { name: "Retry incorrect", exact: true }).click();
  await expect(part(page, 1)).toHaveAttribute("aria-current", "step");
  const first = exam.sections[0].questions[0], second = exam.sections[0].questions[1];
  await expect(question(page, first.id).locator("input:checked")).toHaveCount(0);
  await expect(question(page, second.id).locator('input[value="4"]')).toBeChecked();
  await expect(question(page, second.id).locator('input[value="4"]')).toBeDisabled();
  await question(page, first.id).locator('input[value="1"]').check();
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await expect(visibleMain(page).getByText("Result: 24 / 24 correct", { exact: true })).toBeVisible();
  await expect(visibleMain(page).getByText("First attempt: 23 / 24 correct", { exact: true })).toBeVisible();
  await page.reload();
  await expect(visibleMain(page).getByText("Result: 24 / 24 correct", { exact: true })).toBeVisible();
  expect((await saved(page)).firstScore.correct).toBe(23);
});

test("unanswered submission requires confirmation; restart has an explicit cancel and reset", async ({ page }) => {
  await page.goto(route);
  await question(page, exam.sections[0].questions[0].id).locator('input[value="1"]').check();
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await expect(visibleMain(page).getByRole("group", { name: "Confirm exam submission" })).toContainText("23 questions are unanswered");
  await visibleMain(page).getByRole("button", { name: "Keep answering", exact: true }).click();
  expect((await saved(page)).submitted).toBe(false);
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
  await expect(visibleMain(page).getByText("Result: 1 / 24 correct", { exact: true })).toBeVisible();
  await expect(question(page, exam.sections[0].questions[1].id).locator("[data-listening-feedback]")).toContainText("Unanswered");
  await visibleMain(page).getByRole("button", { name: "Restart exam", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Keep this attempt", exact: true }).click();
  await expect(visibleMain(page).getByText("Result: 1 / 24 correct", { exact: true })).toBeVisible();
  await visibleMain(page).getByRole("button", { name: "Restart exam", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Start a new attempt", exact: true }).click();
  await expect(visibleMain(page).getByText("0 / 24 answered", { exact: true })).toBeVisible();
  expect((await saved(page)).firstScore).toBeNull();
});

test("review keeps English optional and can replay a Japanese audio clue", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("japanese-reviewer:reading-visibility", JSON.stringify({ version: 2, show: { romaji: false, english: false, kana: true } })));
  await page.goto(route);
  await visibleMain(page).getByRole("button", { name: "Submit exam", exact: true }).click();
  await visibleMain(page).getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
  const first = question(page, exam.sections[0].questions[0].id);
  const english = first.locator("[data-reading-hint=english] > span[id]");
  await expect(english).toBeHidden();
  await first.getByRole("button", { name: /^Reveal English for/ }).click();
  await expect(english).toBeVisible();
  await first.locator("summary").click();
  await first.getByRole("button", { name: "Replay this clue", exact: true }).click();
  await expect.poll(() => visibleMain(page).locator("audio").evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThanOrEqual(237);
  expect(await visibleMain(page).locator("audio").evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
});

test("blocked storage retains answers in the open tab", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("japanese-reviewer:listening:")) throw new DOMException("blocked", "SecurityError");
      return original.call(this, key, value);
    };
  });
  await page.goto(route);
  const first = exam.sections[0].questions[0];
  await question(page, first.id).locator('input[value="1"]').check();
  await expect(visibleMain(page)).toContainText("This browser cannot save your answers");
  await part(page, 2).click(); await part(page, 1).click();
  await expect(question(page, first.id).locator('input[value="1"]')).toBeChecked();
});

for (const width of [320, 375]) {
  test(`${width}px: mobile navigation, pictures and choices fit every listening part`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.locator("#mobile-nav").getByRole("link", { name: "Listening", exact: true }).click();
    await expect(page.locator("#mobile-nav")).toBeHidden();
    await expect(page).toHaveURL("/listening");
    await expect(visibleMain(page).getByRole("heading", { name: "Listening exams", exact: true, level: 1 })).toBeVisible();
    await visibleMain(page).locator("#listening").getByRole("link", { name: /^N5 listening/ }).click();
    await expect(page).toHaveURL(route);
    for (const section of exam.sections) {
      await part(page, section.number).click();
      await expect(visibleMain(page).locator("[data-listening-question]")).toHaveCount(section.questions.length);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      for (const image of await visibleMain(page).getByRole("img").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
        const box = await image.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      if (section.number === 3) await question(page, section.questions[0].id).screenshot({ path: testInfo.outputPath("listening-phone.png") });
    }
  });
}

test("a failed audio decode offers a useful fallback", async ({ page }) => {
  await page.route("**/audio/listening/**/*.mp3", route => route.fulfill({ status: 200, contentType: "audio/mpeg", body: "invalid audio" }));
  await page.goto(route);
  await visibleMain(page).locator("audio").evaluate((el: HTMLAudioElement) => el.load());
  await expect(visibleMain(page).getByRole("alert")).toContainText("This audio could not be loaded");
  await expect(visibleMain(page).getByRole("link", { name: "Open this part’s audio file", exact: true })).toHaveAttribute("href", exam.sections[0].audioSrc);
});

test.describe("missing listening exams", () => {
  // Cache Components can stream not-found UI with status 200; assert the page too.
  test.use({ allowedStatuses: [404] });
  test("unknown exams show the not-found page and are excluded from indexing", async ({ page }) => {
    const response = await page.goto("/listening/unknown-exam");
    expect([200, 404]).toContain(response!.status());
    await expect(visibleMain(page).getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
    await expect(visibleMain(page).getByRole("link", { name: "Back to search", exact: true })).toHaveAttribute("href", "/");
  });
});
