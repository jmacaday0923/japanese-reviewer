import { test, expect, visibleMain } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

const sentence = "アナさんは とけいを かいます。";
const chapterEightRow = (page: Page) => visibleMain(page).getByRole("table", { name: "Japanese examples", exact: true })
  .filter({ has: page.getByText(sentence, { exact: true }) }).locator("tbody tr").first();
const aid = (page: Page, kind: string) => visibleMain(page).getByRole("checkbox", { name: "Show " + kind, exact: true });
const hintText = (row: Locator, kind: string) => row.locator(`[data-reading-hint=${kind}] > span[id]`);

// Count the actual rendered text lines, rather than relying on a CSS declaration.
async function lineCount(japanese: Locator) {
  return japanese.evaluate(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const tops = new Set<number>();
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) if (rect.width) tops.add(Math.round(rect.top));
    }
    return tops.size;
  });
}

for (const width of [1024, 1440, 1920]) {
  test(`${width}px: the reported Japanese sentence stays on one line with readings and saved controls`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/chapters/8");
    await aid(page, "english").uncheck();
    const row = chapterEightRow(page);
    const japanese = row.locator(".reading-japanese");
    await expect(japanese).toHaveText(sentence);
    await expect(hintText(row, "romaji")).toBeHidden();
    await expect(hintText(row, "english")).toBeHidden();
    expect(await lineCount(japanese)).toBe(1);
    const before = await row.locator(".reading-example-primary").boundingBox();
    const actions = await row.locator(".reading-example-save").boundingBox();
    expect(actions!.y).toBeGreaterThanOrEqual(before!.y + before!.height);
    const table = row.locator("xpath=ancestor::table");
    await table.locator("thead").getByRole("button", { name: /^Add all/ }).click();
    await expect(row.getByRole("button", { name: /^Saved to flashcards:/ })).toBeDisabled();
    await row.getByRole("button", { name: /^Reveal Romaji for/ }).click();
    await row.getByRole("button", { name: /^Reveal English for/ }).click();
    await expect(hintText(row, "romaji")).toBeVisible();
    await expect(hintText(row, "english")).toBeVisible();
    expect(await lineCount(japanese)).toBe(1);
    const after = await row.locator(".reading-example-primary").boundingBox();
    expect(after!.width).toBeCloseTo(before!.width, 0);
    await row.screenshot({ path: testInfo.outputPath("desktop-example.png") });
  });
}

for (const width of [320, 375]) {
  test(`${width}px: Japanese wraps naturally without clipping or a page-wide scrollbar`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/chapters/8");
    const row = chapterEightRow(page);
    await expect(row.locator(".reading-japanese")).toHaveText(sentence);
    expect(await lineCount(row.locator(".reading-japanese"))).toBeGreaterThan(1);
    const box = await row.locator(".reading-example-primary").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    const frame = row.locator("xpath=ancestor::div[contains(@class, 'reading-examples')]");
    expect(await frame.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await row.getByRole("button", { name: /^Reveal Romaji for/ }).click();
    await expect(hintText(row, "romaji")).toBeVisible();
    expect(await frame.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await row.screenshot({ path: testInfo.outputPath("phone-example.png") });
  });
}

test("kanji reference charts retain aligned table columns", async ({ page }) => {
  await page.goto("/kanji/1");
  const table = visibleMain(page).locator(".lesson table").filter({
    has: page.getByRole("columnheader", { name: "Word", exact: true }),
  }).first();
  await expect(table).toBeVisible();
  expect(await table.evaluate(el => getComputedStyle(el).display)).toBe("table");
  const row = table.locator("tbody tr").first();
  const word = await row.locator("td").nth(0).boundingBox();
  const kana = await row.locator("td").nth(1).boundingBox();
  expect(word!.y).toBeCloseTo(kana!.y, 0);
});
