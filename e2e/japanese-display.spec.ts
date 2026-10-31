import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, visibleMain } from "./fixtures";

const aids = (page: import("@playwright/test").Page) => visibleMain(page).getByRole("checkbox", { name: "Show romaji", exact: true });
const hintContent = (hint: import("@playwright/test").Locator) => hint.locator(":scope > span[id]");
const chapters = JSON.parse(readFileSync(join(__dirname, "../src/data/chapters.json"), "utf8")) as { ch: string; sections: { id: string; html: string }[] }[];
const chapter8 = chapters.find(c => c.ch === "8")!;
const reportedId = /<h3 id="([^"]+)">Part U: Answer the question<\/h3>/.exec(chapter8.sections.find(s => s.id === "exercises")!.html)![1];
const reportedTable = (page: import("@playwright/test").Page) => visibleMain(page).locator(`[id="${reportedId}"]`).locator("xpath=following-sibling::div[contains(@class,'tw')][1]");

for (const path of [...Array.from({ length: 15 }, (_, i) => `/chapters/${i + 1}`), "/kana/1", "/kanji/1", "/kanji/2"]) {
  test(`${path}: Japanese is visible and common romaji prompts are hidden by default`, async ({ page }) => {
    await page.goto(path);
    await expect(aids(page)).toBeEnabled();
    await expect(aids(page)).not.toBeChecked();
    const lessons = visibleMain(page).locator(".lesson");
    await expect(lessons.first()).toBeVisible();
    const visible = await lessons.evaluateAll(elements => elements.map(element => (element as HTMLElement).innerText).join("\n"));
    expect(visible).toMatch(/[ぁ-んァ-ン一-龯]/u);
    expect(visible).not.toMatch(/\b(?:watashi|anata|gakusei|arimasu|arimasen|imasu|imasen|tabemasu|tabemashita|nomimasu|ikimasu|desu|deshita|masu|mashita|nomanai|nihongo)\b/u);
    const romaji = lessons.locator('[data-reading-hint="romaji"]');
    expect(await romaji.count()).toBeGreaterThan(0);
    expect(await romaji.locator(":scope > span[id]").evaluateAll(elements => elements.every(element => getComputedStyle(element).visibility === "hidden" || (element as HTMLElement).hidden))).toBe(true);
  });
}

test("the reported questions keep Japanese and English cues while each romaji hint can be revealed", async ({ page }, testInfo) => {
  await page.goto(`/chapters/8#${reportedId}`);
  const table = reportedTable(page);
  await expect(table.locator("tbody tr")).toHaveCount(8);
  const first = table.locator("tbody tr").first().locator("td").nth(1);
  await expect(first.locator("[data-study-primary]")).toHaveText("けさ、なにをたべましたか。 (bread)");
  const hint = first.locator("[data-reading-hint=romaji]");
  await expect(hintContent(hint)).toBeHidden();
  const button = hint.getByRole("button");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(hintContent(hint)).toBeVisible();
  await expect(hintContent(hint)).toHaveText("kesa nani o tabemashita ka. (bread)");
  const other = table.locator("tbody tr").nth(1).locator("[data-reading-hint=romaji]");
  await expect(hintContent(other)).toBeHidden();
  await expect(aids(page)).not.toBeChecked();
  await visibleMain(page).getByRole("button", { name: "Hide revealed hints" }).click();
  await expect(hintContent(hint)).toBeHidden();
  await page.setViewportSize({ width: 375, height: 800 });
  await first.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await table.locator("tbody tr").first().screenshot({ path: testInfo.outputPath("japanese-question.png"), style: "header { visibility: hidden !important; }" });
});

test("interactive particles and vocabulary use Japanese while grading still accepts kana and romaji", async ({ page }) => {
  await page.goto("/chapters/1");
  const practice = visibleMain(page).getByRole("region", { name: "Interactive practice" });
  const prompt = practice.locator('[id="c1-particles-1-prompt"]');
  await expect(prompt).toContainText("わたし");
  expect(await prompt.innerText()).not.toContain("watashi");
  const input = practice.getByRole("textbox", { name: "Your answer for question 1", exact: true });
  await input.fill("は");
  await practice.getByRole("button", { name: "Check answer 1", exact: true }).click();
  const feedback = practice.locator('[id="c1-particles-1-feedback"]');
  await expect(feedback).toContainText("Correct");
  await expect(feedback.locator("[data-study-primary]").first()).toHaveText("は");
  await expect(feedback.locator("[data-reading-hint=romaji] > span[id]").first()).toBeHidden();
  const second = practice.getByRole("textbox", { name: "Your answer for question 2", exact: true });
  await second.fill("no");
  await second.press("Enter");
  await expect(practice.locator('[id="c1-particles-2-feedback"]')).toContainText("Correct");
  await practice.getByRole("tab", { name: "Vocabulary (10)", exact: true }).click();
  const word = practice.getByRole("combobox").first();
  await expect(word).toHaveAccessibleName(/Meaning of [ぁ-んァ-ン一-龯]/u);
  expect(await practice.getByRole("tabpanel").filter({ visible: true }).innerText()).not.toMatch(/\b(?:kaishain|chichi|okaasan)\b/u);
});

test("old always-visible preference migrates once and an explicit Show romaji choice persists", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("japanese-reviewer:reading-visibility")) localStorage.setItem("japanese-reviewer:reading-visibility", JSON.stringify({ version: 1, show: { romaji: true, english: false, kana: false } }));
  });
  await page.goto("/kanji/2");
  await expect(aids(page)).not.toBeChecked();
  await expect(visibleMain(page).getByRole("checkbox", { name: "Show english", exact: true })).not.toBeChecked();
  await expect(visibleMain(page).getByRole("checkbox", { name: "Show kana readings", exact: true })).not.toBeChecked();
  await aids(page).check();
  await page.reload();
  await expect(aids(page)).toBeChecked();
  await page.goto(`/chapters/8#${reportedId}`);
  const first = reportedTable(page).locator("tbody tr").first().locator("[data-reading-hint=romaji]");
  await expect(hintContent(first)).toBeVisible();
  await expect(visibleMain(page).getByRole("checkbox", { name: "Show english", exact: true })).not.toBeChecked();
});

test("Kana writing cues do not give away the script answers and original sound cues remain optional", async ({ page }) => {
  await page.goto("/kana/1");
  const headings = visibleMain(page).locator("#exercises h3");
  const h = headings.filter({ hasText: "Part M:" });
  const table = h.locator("xpath=following-sibling::div[contains(@class,'tw')][1]");
  const first = table.locator("tbody tr").first().locator("td").nth(1);
  await expect(first.locator("[data-study-primary]")).toHaveText("I am a student.");
  const hint = first.locator("[data-reading-hint=romaji]");
  await expect(hintContent(hint)).toBeHidden();
  await hint.getByRole("button").click();
  await expect(hintContent(hint)).toHaveText("watashi wa gakusei desu.");
});
