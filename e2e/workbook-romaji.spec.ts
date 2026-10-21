import type { Locator, Page } from "@playwright/test";
import { test, expect, visibleMain } from "./fixtures";
import audit from "../migration/workbook-romaji-audit.json";

const activities = (page: Page) => visibleMain(page).locator("[data-workbook-activity]");
const activity = (page: Page, heading: string) => visibleMain(page).locator('[data-workbook-activity="' + heading + '"]');
const support = (region: Locator) => region.locator("details[data-workbook-romaji]");
const body = (region: Locator) => support(region).locator(".workbook-romaji-body");
const questions = (region: Locator) => region.locator(".tw tbody tr");

for (const chapter of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]) {
  test("Chapter " + chapter + ": workbook prompts stay visible while all romaji support starts closed", async ({ page }) => {
    const expected = audit.activities.filter(item => item.chapter === chapter);
    await page.goto("/chapters/" + chapter + "#c" + chapter + "-workbook-exercises");
    await expect(activities(page)).toHaveCount(expected.length);
    // Read this large page once rather than spending the test budget on many
    // browser round trips. Check every native prompt, not just the first row.
    const snapshot = await activities(page).evaluateAll(elements => elements.map(region => ({
      heading: region.getAttribute("data-workbook-activity"),
      rows: [...region.querySelectorAll(".tw tbody tr")].map(row => {
        const japanese = row.querySelector('td:nth-child(2) > span[lang="ja"]');
        return japanese ? { text: japanese.textContent ?? "", visible: japanese.checkVisibility() } : null;
      }),
      supports: [...region.querySelectorAll("details[data-workbook-romaji]")].map(panel => ({
        open: panel.hasAttribute("open"),
        visible: panel.querySelector(".workbook-romaji-body")?.checkVisibility() ?? false,
      })),
      paragraphs: [...region.querySelectorAll("p")].filter(p => p.checkVisibility()).map(p => (p.textContent ?? "").replace(/\s+/g, " ").trim()),
    })));
    for (const [index, item] of expected.entries()) {
      const actual = snapshot[index];
      expect(actual.heading).toBe(item.heading);
      expect(actual.rows).toHaveLength(item.rowCount);
      expect(actual.supports).toEqual(item.hasSupport ? [{ open: false, visible: false }] : []);
      for (const q of item.questions) expect(actual.rows[q.number - 1]).toEqual({ text: q.japanese, visible: true });
      for (const passage of item.passages) expect(actual.paragraphs).toContain(passage.japanese.replace(/\s+/g, " ").trim());
    }
    const first = activity(page, expected.find(item => item.hasSupport)!.heading);
    await support(first).locator("summary").click();
    await expect(body(first)).toBeVisible();
    await expect(questions(first).first()).toBeVisible();
    await page.reload();
    await expect(body(first)).toBeHidden();
  });
}

test("the reported Chapter 8 conjugation table shows Japanese; one toggle reveals the romaji readings", async ({ page }) => {
  await page.goto("/chapters/8#c8-verb-conjugation-page-118");
  const region = activity(page, "c8-verb-conjugation-page-118");
  const first = questions(region).first().locator("td").nth(1);
  await expect(first).toContainText("のみます");
  await expect(first).not.toContainText("nomimasu");
  await expect(region.getByText("たべます", { exact: false }).first()).toBeVisible();
  await expect(body(region)).toBeHidden();
  const summary = support(region).locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(body(region)).toBeVisible();
  await expect(body(region).locator("li").first()).toHaveText("nomimasu");
  await expect(first).toBeVisible();
  await page.keyboard.press("Space");
  await expect(body(region)).toBeHidden();
});

test("workbook reveals are independent of other activities, global aids and saved study data", async ({ page }) => {
  await page.goto("/chapters/8#c8-workbook-exercises");
  const first = activity(page, "c8-verb-conjugation-page-118");
  const other = activity(page, "c8-fill-in-the-appropriate-marker-page-122");
  const checkbox = visibleMain(page).getByRole("checkbox", { name: "Show romaji", exact: true });
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(body(first)).toBeHidden();
  await checkbox.uncheck();
  const before = await page.evaluate(() => ({
    aids: localStorage.getItem("japanese-reviewer:reading-visibility"),
    flashcards: localStorage.getItem("japanese-reviewer:flashcards"),
    study: localStorage.getItem("japanese-reviewer:study"),
  }));
  await support(first).locator("summary").click();
  await expect(body(first)).toBeVisible();
  await expect(body(other)).toBeHidden();
  const after = await page.evaluate(() => ({
    aids: localStorage.getItem("japanese-reviewer:reading-visibility"),
    flashcards: localStorage.getItem("japanese-reviewer:flashcards"),
    study: localStorage.getItem("japanese-reviewer:study"),
  }));
  expect(after).toEqual(before);
});

test("required English translation prompts, picture descriptions and Japanese adjective choices remain visible", async ({ page }) => {
  await page.goto("/chapters/2#c2-workbook-exercises");
  const translation = activity(page, "c2-translation-page-39");
  await expect(translation).toContainText("My cell phone is inside the bag.");
  await expect(questions(translation).first()).toBeVisible();
  await expect(support(translation)).toHaveCount(0);
  const pictures = activity(page, "c2-reading-comprehension-page-38");
  await expect(questions(pictures).first()).toContainText("a building with a bookstore");
  await expect(questions(pictures).first()).toBeVisible();
  await page.goto("/chapters/6#c6-choose-the-adjective-page-94");
  const adjectives = activity(page, "c6-choose-the-adjective-page-94");
  const wordBank = adjectives.locator("p").filter({ hasText: /^Box:/ }).first();
  await expect(wordBank).toBeVisible();
  await expect(wordBank).toContainText("さむい");
  await expect(wordBank).not.toContainText("samui");
});

test("search still shows romaji and opens the workbook heading with support closed", async ({ page }) => {
  await page.goto("/?q=nomimasu&category=practice&chapter=8");
  const link = page.locator('#search a[href="/chapters/8#c8-verb-conjugation-page-118"]').first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL("/chapters/8#c8-verb-conjugation-page-118");
  const region = activity(page, "c8-verb-conjugation-page-118");
  await expect(body(region)).toBeHidden();
  await expect(questions(region).first()).toContainText("のみます");
});

test("phone: workbook controls and Japanese prompts fit the page at 375 and 320 pixels", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/chapters/8#c8-verb-conjugation-page-118");
  const region = activity(page, "c8-verb-conjugation-page-118");
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect((await support(region).locator("summary").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await support(region).locator("summary").click();
    await expect(body(region)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await support(region).locator("summary").click();
    await expect(body(region)).toBeHidden();
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await region.screenshot({ path: testInfo.outputPath("workbook-romaji-phone.png"), style: "header { visibility: hidden !important; }" });
});
