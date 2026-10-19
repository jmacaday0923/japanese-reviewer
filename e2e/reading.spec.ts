import { test, expect, search, visibleMain } from "./fixtures";

const key = "japanese-reviewer:reading-visibility";
const aid = (page: import("@playwright/test").Page, kind: string) => visibleMain(page).getByRole("checkbox", { name: "Show " + kind, exact: true });
const hints = (page: import("@playwright/test").Page, kind: string) => visibleMain(page).locator('[data-reading-hint="' + kind + '"]');
const content = (hint: import("@playwright/test").Locator) => hint.locator(":scope > span[id]");

test.use({ viewport: { width: 1440, height: 900 } });

test("three independent toggles; reveal one hint; re-hide; refresh persistence", async ({ page }) => {
  await page.goto("/chapters/1");
  await expect(aid(page, "romaji")).toBeChecked();
  const romaji = hints(page, "romaji");
  const english = hints(page, "english");
  await expect(content(romaji.first())).toBeVisible();
  await aid(page, "romaji").uncheck();
  await expect(content(romaji.first())).toBeHidden();
  await expect(content(english.first())).toBeVisible();
  await romaji.first().getByRole("button").click();
  await expect(content(romaji.first())).toBeVisible();
  await expect(content(romaji.nth(1))).toBeHidden();
  await expect(aid(page, "romaji")).not.toBeChecked();
  await visibleMain(page).getByRole("button", { name: "Hide revealed hints" }).click();
  await expect(content(romaji.first())).toBeHidden();
  await aid(page, "english").uncheck();
  await expect(content(english.first())).toBeHidden();
  await expect(aid(page, "kana readings")).toBeChecked();
  await expect(aid(page, "furigana")).toHaveCount(0);
  await page.reload();
  await expect(aid(page, "romaji")).not.toBeChecked();
  await expect(aid(page, "english")).not.toBeChecked();
  await expect(content(romaji.first())).toBeHidden();
  await expect(content(english.first())).toBeHidden();
  await expect(page).toHaveURL("/chapters/1");
});

test("kana readings toggle independently while kanji stays plain, with per-item reveals", async ({ page }) => {
  await page.goto("/kanji/1");
  await expect(visibleMain(page).getByRole("checkbox")).toHaveCount(3);
  await expect(aid(page, "kana readings")).toBeChecked();
  const words = visibleMain(page).locator(".lesson table").filter({
    has: page.getByRole("columnheader", { name: "Word", exact: true }),
  }).first();
  const row = words.locator("tbody tr").first();
  const word = row.locator("td").nth(0);
  const kana = row.locator("td").nth(1).locator("[data-reading-hint=kana]");
  const wordBefore = await word.textContent();
  const kanaBefore = await content(kana).textContent();
  expect(wordBefore?.trim()).toBeTruthy();
  expect(kanaBefore?.trim()).toBeTruthy();
  await aid(page, "romaji").uncheck();
  await aid(page, "english").uncheck();
  await expect(word).toHaveText(wordBefore!);
  await expect(content(kana)).toBeVisible();
  await aid(page, "kana readings").uncheck();
  await expect(word).toBeVisible();
  await expect(word).toHaveText(wordBefore!);
  await expect(content(kana)).toBeHidden();
  const otherReading = visibleMain(page).locator(".lesson table").filter({
    has: page.getByRole("columnheader", { name: "On'yomi", exact: true }),
  }).first().locator("[data-reading-hint=kana]").first();
  await expect(content(otherReading)).toBeHidden();
  await expect(kana.getByRole("button")).toHaveAttribute("aria-label", /Reveal kana reading for/);
  expect(await kana.getByRole("button").getAttribute("aria-label")).not.toContain(kanaBefore!.trim());
  await kana.getByRole("button").click();
  await expect(content(kana)).toBeVisible();
  await expect(content(kana)).toHaveText(kanaBefore!);
  await expect(content(otherReading)).toBeHidden();
  await expect(visibleMain(page).locator("ruby, rt, [data-reading-word], [data-reading-hint=furigana]")).toHaveCount(0);
});

test("search always shows readings and meanings while study choices stay hidden", async ({ page }) => {
  await page.goto("/kanji/1");
  for (const kind of ["romaji", "english", "kana readings"]) await aid(page, kind).uncheck();
  const before = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
  await page.goto("/?q=gakkou&category=vocab");
  const s = search(page);
  const first = s.results.first();
  await expect(first).toBeVisible();
  await expect(page.locator("#search").getByRole("group", { name: "Reading aids" })).toHaveCount(0);
  await expect(page.locator("#search").getByRole("checkbox")).toHaveCount(0);
  await expect(page.locator("#search [data-reading-hint]")).toHaveCount(0);
  for (const value of ["学校", "がっこう", "gakkou", "school"]) {
    await expect(first.getByText(value, {exact: true})).toBeVisible();
  }
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(before);
  const link = first.getByRole("link");
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(href!);
  for (const kind of ["romaji", "english", "kana readings"]) await expect(aid(page, kind)).not.toBeChecked();
  for (const kind of ["romaji", "english", "kana"]) await expect(content(hints(page, kind).first())).toBeHidden();
});

test("keyboard reveal controls have expanded state and hidden hints leave the accessible tree", async ({ page }) => {
  await page.goto("/chapters/1");
  await aid(page, "english").uncheck();
  const hint = hints(page, "english").first();
  const button = hint.getByRole("button");
  await expect(content(hint)).toHaveAttribute("aria-hidden", "true");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(content(hint)).toHaveAttribute("aria-hidden", "false");
  await page.keyboard.press("Space");
  await expect(content(hint)).toBeHidden();
});

test("blocked storage keeps independent choices for this tab", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === "japanese-reviewer:reading-visibility") throw new DOMException("blocked", "SecurityError");
      return original.call(this, name, value);
    };
  });
  await page.goto("/chapters/1");
  await aid(page, "english").uncheck();
  await expect(content(hints(page, "english").first())).toBeHidden();
  await expect(visibleMain(page)).toContainText("This browser cannot save these choices");
  await visibleMain(page).getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" }).click();
  await page.getByRole("link", { name: "Existential Sentences", exact: true }).click();
  await expect(aid(page, "english")).not.toBeChecked();
});

test("other tabs synchronize preferences without changing bookmark data", async ({ page, context }) => {
  await page.goto("/chapters/1");
  await expect(aid(page, "english")).toBeEnabled();
  const before = await page.evaluate(() => localStorage.getItem("japanese-reviewer:study"));
  const other = await context.newPage();
  await other.goto("/kana/1");
  await aid(page, "english").uncheck();
  await expect(aid(other, "english")).not.toBeChecked();
  await expect(content(hints(other, "english").first())).toBeHidden();
  // The reader itself records visits; preference changes do not touch that storage.
  const afterVisit = await page.evaluate(() => localStorage.getItem("japanese-reviewer:study"));
  await aid(page, "romaji").uncheck();
  expect(await page.evaluate(() => localStorage.getItem("japanese-reviewer:study"))).toBe(afterVisit);
  expect(before).not.toBeNull();
  await other.close();
});

test("phone controls wrap without clipping", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/kana/1");
  await aid(page, "romaji").uncheck();
  await aid(page, "english").uncheck();
  const fieldset = visibleMain(page).getByRole("group", { name: "Reading aids" });
  const box = await fieldset.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  const hint = hints(page, "romaji").first();
  await hint.getByRole("button").click();
  await expect(content(hint)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("japanese-reviewer:reading-visibility")!).version)).toBe(1);
});

test("original furigana preference migrates to kana readings without ruby", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, show: { romaji: false, english: false, furigana: false } }));
  }, key);
  await page.goto("/kanji/2");
  await expect(aid(page, "furigana")).toHaveCount(0);
  await expect(aid(page, "romaji")).not.toBeChecked();
  await expect(content(hints(page, "english").first())).toBeHidden();
  await expect(visibleMain(page).locator("ruby, rt, [data-reading-hint=furigana]")).toHaveCount(0);
  await expect(visibleMain(page).getByRole("checkbox")).toHaveCount(3);
  await expect(aid(page, "kana readings")).not.toBeChecked();
  await expect(content(hints(page, "kana").first())).toBeHidden();
});

test("two-toggle saved preferences keep existing choices and enable kana readings by default", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, show: { romaji: false, english: false } }));
  }, key);
  await page.goto("/kanji/1");
  await expect(aid(page, "romaji")).not.toBeChecked();
  await expect(aid(page, "english")).not.toBeChecked();
  await expect(aid(page, "kana readings")).toBeChecked();
  await expect(content(hints(page, "kana").first())).toBeVisible();
});

test("kanji search readings stay visible when the study kana toggle is off", async ({ page }) => {
  await page.goto("/kanji/1");
  await aid(page, "kana readings").uncheck();
  const before = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
  await page.goto("/?q=hitotsu&category=script&chapter=kanji");
  const row = search(page).results.first();
  await expect(row).toBeVisible();
  await expect(row.getByText("ひとつ", {exact: true})).toBeVisible();
  await expect(row.getByText("hitotsu", {exact: true})).toBeVisible();
  await expect(row.locator("[data-reading-hint], ruby, rt, a button")).toHaveCount(0);
  await expect(page.locator("#search").getByRole("checkbox")).toHaveCount(0);
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(before);
});

test("Japanese examples lead supporting English in lessons and search", async ({ page }) => {
  await page.goto("/chapters/1");
  const table = visibleMain(page).getByRole("table", { name: "Japanese examples", exact: true }).first();
  const row = table.locator("tbody tr").first();
  const japanese = row.locator(".reading-japanese");
  const english = row.locator("[data-reading-hint=english] .reading-supporting");
  await expect(english).toBeVisible();
  await expect(japanese).toHaveAttribute("lang", "ja");
  expect(await japanese.evaluate(el => parseFloat(getComputedStyle(el).fontSize)))
    .toBeGreaterThan(await english.evaluate(el => parseFloat(getComputedStyle(el).fontSize)));
  expect(await table.evaluate(el => getComputedStyle(el).display)).toBe("table");
  const japaneseCell = await row.locator("td").nth(0).boundingBox();
  const englishCell = await row.locator("td").nth(2).boundingBox();
  expect(japaneseCell!.y).toBe(englishCell!.y);

  await page.goto("/?q=watashi%20wa%20gakusei%20desu");
  const result = search(page).results.filter({ has: page.locator(".reading-japanese") }).first();
  await expect(result).toBeVisible();
  const resultJapanese = result.locator(".reading-japanese").first();
  expect(await resultJapanese.evaluate(el => parseFloat(getComputedStyle(el).fontSize)))
    .toBeGreaterThan(await result.locator("dd").last().evaluate(el => parseFloat(getComputedStyle(el).fontSize)));
  await expect(result.locator("[data-reading-hint]")).toHaveCount(0);
});

for (const width of [320, 375]) {
  test(width + "px: stacked examples keep hints and flashcard actions through a resize", async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/chapters/1");
    const frame = visibleMain(page).locator(".reading-examples").first();
    const table = frame.getByRole("table", { name: "Japanese examples", exact: true });
    const row = table.locator("tbody tr").first();
    const japanese = row.locator(".reading-japanese");
    const englishHint = row.locator("[data-reading-hint=english]");
    const english = content(englishHint);
    await expect(english).toBeVisible();
    expect(await frame.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await row.evaluate(el => getComputedStyle(el).display)).toBe("block");
    const japaneseCell = await row.locator("td").nth(0).boundingBox();
    const englishCell = await row.locator("td").nth(2).boundingBox();
    expect(englishCell!.y).toBeGreaterThanOrEqual(japaneseCell!.y + japaneseCell!.height);
    expect(await japanese.evaluate(el => parseFloat(getComputedStyle(el).fontSize)))
      .toBeGreaterThan(await row.locator(".reading-supporting").last().evaluate(el => parseFloat(getComputedStyle(el).fontSize)));
    await expect(table.getByRole("columnheader", { name: "Japanese", exact: true })).toHaveCount(1);
    await row.screenshot({ path: testInfo.outputPath("stacked-example.png") });

    await aid(page, "english").uncheck();
    await expect(english).toBeHidden();
    const reveal = englishHint.getByRole("button");
    await reveal.focus();
    await page.keyboard.press("Enter");
    await expect(english).toBeVisible();
    await row.getByRole("button", { name: /^Add to flashcards:/ }).click();
    await expect(row.getByRole("button", { name: /^Saved to flashcards:/ })).toBeDisabled();
    await table.locator("thead").getByRole("button", { name: /^Add all/ }).click();
    await expect(table.locator("thead").getByRole("button", { name: /^All \d+ saved$/ })).toBeDisabled();

    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await table.evaluate(el => getComputedStyle(el).display)).toBe("table");
    await expect(english).toBeVisible();
    await expect(row.getByRole("button", { name: /^Saved to flashcards:/ })).toBeDisabled();
    await expect(table.locator("[data-reading-hint=english]")).toHaveCount(await table.locator("tbody tr").count());

    await page.setViewportSize({ width, height: 800 });
    await page.goto("/chapters/3");
    const dialogue = visibleMain(page).locator(".reading-examples table").filter({
      has: page.getByRole("columnheader", { name: "Speaker", exact: true }),
    }).first();
    const dialogueRow = dialogue.locator("tbody tr").first();
    await expect(dialogueRow.locator(".reading-cell-label").first()).toHaveText("Speaker");
    await expect(dialogueRow.locator(".reading-cell-label").first()).toBeVisible();
    await expect(dialogueRow.locator(".reading-japanese")).toBeVisible();
    expect(await dialogue.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });
}
