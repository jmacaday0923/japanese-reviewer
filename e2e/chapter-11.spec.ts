import { test, expect, visibleMain, search, offsetFromAnchorTarget, type Page } from "./fixtures";
import raw from "../src/data/workbook-exercises.json";
import type { WorkbookBank } from "../src/types/workbook";
const sets = (raw as WorkbookBank).chapters.find(c => c.chapter === "11")!.sets;
const activity = (page: Page, id: string) => visibleMain(page).locator('[data-workbook-activity="' + id + '"]');
const question = (page: Page, id: string) => visibleMain(page).locator('[data-workbook-question="' + id + '"]');

test("Chapter 11 appears on the dashboard, after Chapter 10, with its full outline", async ({ page }) => {
  await page.goto("/");
  const link = visibleMain(page).locator('#chapters a[href="/chapters/11"]');
  await expect(link).toHaveText("Set Phrases, Changes and Potential Forms");
  await link.click();
  await expect(page).toHaveURL("/chapters/11");
  await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText("Set Phrases, Changes and Potential Forms");
  await expect(visibleMain(page).locator("[data-workbook-activity]")).toHaveCount(12);
  await expect(visibleMain(page).locator("[data-workbook-question]")).toHaveCount(90);
  const pager = visibleMain(page).getByRole("navigation", { name: "Chapter pages" });
  await expect(pager.getByRole("link")).toHaveCount(2);
  await expect(pager.getByRole("link").last()).toHaveAttribute("href", "/chapters/12");
  await pager.getByRole("link").first().click();
  await expect(page).toHaveURL("/chapters/10");
  await expect(visibleMain(page).getByRole("navigation", { name: "Chapter pages" }).getByRole("link").last()).toHaveAttribute("href", "/chapters/11");
  await expect(visibleMain(page).getByRole("link", { name: "Vocabulary checkpoint", exact: true })).toBeVisible();
});
test("English task instructions follow Japanese in all activities, even with English hints hidden", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("japanese-reviewer:reading-visibility", JSON.stringify({
    version: 2, show: { kana: true, romaji: false, english: false },
  })));
  await page.goto("/chapters/11#exercises");
  const englishToggle = visibleMain(page).getByRole("checkbox", { name: "Show english", exact: true });
  await expect(englishToggle).not.toBeChecked();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const set of sets) {
      const group = activity(page, set.id);
      const japanese = group.locator(':scope > p[lang="ja"]').first();
      const english = group.locator(':scope > p[lang="ja"] + p[lang="en"]');
      expect(set.instructionsEn, set.id + " has English directions").toBeTruthy();
      await expect(japanese).toHaveText(set.instructionsJa);
      await expect(english).toHaveText(set.instructionsEn!);
      await expect(english).toBeVisible();
      const layout = await english.evaluate(el => {
        const rect = el.getBoundingClientRect(), previous = el.previousElementSibling!;
        return {
          below: rect.top >= previous.getBoundingClientRect().bottom - 1,
          smaller: parseFloat(getComputedStyle(el).fontSize) < parseFloat(getComputedStyle(previous).fontSize),
          fits: rect.left >= 0 && rect.right <= innerWidth + 1 && el.scrollWidth <= el.clientWidth + 1,
        };
      });
      expect(layout, set.id + " at " + width + "px").toEqual({ below: true, smaller: true, fits: true });
    }
  }
  await englishToggle.check();
  await englishToggle.uncheck();
  for (const set of sets) await expect(activity(page, set.id).locator(':scope > p[lang="en"]')).toBeVisible();
});
test("all 68 checked workbook questions accept their reviewed model in the browser", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/chapters/11#exercises");
  for (const set of sets) for (const q of set.questions) {
    if (q.mode === "self") continue;
    const item = question(page, q.id);
    if (q.mode === "choice") await item.locator('input[value="' + q.correctChoiceId + '"]').check();
    else if (q.mode === "text") await item.getByRole("textbox", { name: "Your answer", exact: true }).fill(q.model);
    else {
      const order = q as typeof sets[number]["questions"][number] & { acceptedOrders: number[][] };
      for (const id of order.acceptedOrders[0]) await item.locator("[data-workbook-tiles] button").nth(id).click();
    }
    await item.getByRole("button", { name: "Check answer", exact: true }).click();
    await expect(item.locator("[data-workbook-feedback]")).toContainText("Correct");
    if (q.mode === "text") await expect(item.getByRole("textbox")).toBeDisabled();
  }
});
test("wrong answers, retries and first scores behave consistently", async ({ page }) => {
  const set = sets.find(s => s.id === "c11-change-choices")!;
  await page.goto("/chapters/11#" + set.heading);
  for (const q of set.questions) {
    const item = question(page, q.id);
    await item.locator('input[value="' + (q.number === 1 ? "1" : q.correctChoiceId) + '"]').check();
    await item.getByRole("button", { name: "Check answer", exact: true }).click();
  }
  const group = activity(page, set.id);
  await expect(group).toContainText("First try: 9 of 10 correct");
  await group.getByRole("button", { name: /^Retry incorrect/ }).click();
  const first = question(page, set.questions[0].id);
  await expect(first.locator("input:checked")).toHaveCount(0);
  await expect(question(page, set.questions[1].id).locator("input:checked")).toBeDisabled();
  await first.locator('input[value="3"]').check();
  await first.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(group).toContainText("All 10 questions correct");
  await expect(group).toContainText("First try: 9 of 10 correct");
});
test("open responses require writing first and clearly separate self-checks from grading", async ({ page }) => {
  const set = sets.find(s => s.id === "c11-personal-answers")!;
  await page.goto("/chapters/11#" + set.heading);
  const first = question(page, set.questions[0].id);
  await first.getByRole("button", { name: "Show model answer", exact: true }).click();
  await expect(first.locator("[data-workbook-feedback]")).toHaveCount(0);
  const input = first.getByRole("textbox");
  await expect(input).toBeFocused();
  await input.fill("いいえ、からいりょうりは あまり 食べられません。");
  await input.press("Enter");
  await expect(first.locator("[data-workbook-feedback]")).toHaveCount(0);
  await first.getByRole("button", { name: "Show model answer", exact: true }).click();
  await expect(first.locator("[data-workbook-feedback]")).toContainText("Compare your own response");
  await first.getByRole("button", { name: "Needs review", exact: true }).click();
  await expect(activity(page,set.id)).toContainText("0 satisfied · 1 need review");
  await activity(page,set.id).getByRole("button", { name: "Retry needs review", exact: true }).click();
  await expect(input).toBeEmpty();
  await expect(first.locator("[data-workbook-feedback]")).toHaveCount(0);
});
test("word tiles support undo, removal and keyboard selection", async ({ page }) => {
  await page.goto("/chapters/11#c11-word-order");
  const item = question(page,"c11-word-order-1"), bank = item.locator("[data-workbook-tiles] button");
  await bank.nth(2).focus(); await page.keyboard.press("Enter");
  const chosen = item.locator("[data-workbook-chosen] button");
  await expect(chosen).toHaveCount(1);
  await expect(chosen).toHaveAttribute("aria-label", "Remove word 1: 五月");
  await expect(chosen.locator("rt")).toHaveText("ごがつ");
  await item.getByRole("button",{name:"Undo last word",exact:true}).click();
  await expect(item.locator("[data-workbook-chosen] button")).toHaveCount(0);
  for (const id of [2,1,3,0]) await bank.nth(id).click();
  await item.getByRole("button",{name:"Check answer",exact:true}).click();
  await expect(item.locator("[data-workbook-feedback]")).toContainText("Correct");
});
test("reading support starts closed and reveals independently; notes stay below the passage", async ({ page }) => {
  await page.goto("/chapters/11#c11-reading-comprehension");
  const block = visibleMain(page).locator('[data-reading-exercise="c11-reading-comprehension"]');
  await expect(block.locator(".reading-japanese")).toHaveCount(4);
  const romaji = block.locator('[data-reading-support="romaji"]'), english = block.locator('[data-reading-support="english"]');
  await expect(romaji).not.toHaveAttribute("open");
  await expect(english).not.toHaveAttribute("open");
  await romaji.locator("summary").click();
  await expect(romaji).toHaveAttribute("open","");
  await expect(english).not.toHaveAttribute("open");
  await english.locator("summary").click();
  await expect(english).toHaveAttribute("open","");
  await expect(visibleMain(page).locator("#exercises")).toContainText("いいおもいで");
  await expect(block.locator(".reading-japanese ruby").first()).toContainText("大学");
  await expect(block.locator(".reading-japanese rt").first()).toHaveText("だいがく");
  await expect(romaji.locator("ruby")).toHaveCount(0);
  const hint = question(page,"c11-personal-answers-1").locator('[data-reading-hint="romaji"]');
  await expect(hint.locator(":scope > span[id]")).toBeHidden();
  await hint.getByRole("button").click();
  await expect(hint.locator(":scope > span[id]")).toBeVisible();
});
test("text grammar accepts the valid が and を alternatives", async ({ page }) => {
  await page.goto("/chapters/11#c11-text-grammar");
  const item = question(page,"c11-text-grammar-3");
  await item.locator('input[value="1"]').check();
  await item.getByRole("button",{name:"Check answer",exact:true}).click();
  await expect(item.locator("[data-workbook-feedback]")).toContainText("Correct");
  await activity(page,"c11-text-grammar").getByRole("button",{name:"Restart practice",exact:true}).click();
  await item.locator('input[value="4"]').check();
  await item.getByRole("button",{name:"Check answer",exact:true}).click();
  await expect(item.locator("[data-workbook-feedback]")).toContainText("Correct");
});
test("search filters Chapter 11 and opens a preserved exercise heading", async ({ page }) => {
  await page.goto("/?q=kikoeru&chapter=11");
  const s = search(page);
  await expect(s.chapter.locator('option[value="11"]')).toHaveText("Chapter 11");
  await expect(s.results.first()).toBeVisible();
  const link = s.results.first().getByRole("link"), href = (await link.getAttribute("href"))!;
  expect(href).toContain("/chapters/11#");
  await link.click();
  await expect.poll(() => offsetFromAnchorTarget(page,decodeURIComponent(href.split("#")[1]))).toBeLessThanOrEqual(1);
});
test("Chapter 11 bookmarks and Continue Studying resolve after returning home", async ({ page }) => {
  await page.goto("/chapters/11");
  await visibleMain(page).getByRole("button", { name: "Bookmark page", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("japanese-reviewer:study") ?? "null")?.lastVisit?.id)).toBe("11");
  await page.goto("/");
  const shelf = visibleMain(page).getByRole("heading", { name: /^Bookmarks/, level: 3 }).locator("..");
  await expect(shelf.getByRole("link").filter({ hasText: "Set Phrases, Changes and Potential Forms" })).toHaveAttribute("href", "/chapters/11");
  const resume = visibleMain(page).getByRole("heading", { name: "Continue studying", level: 3 }).locator("..");
  await expect(resume.getByRole("link")).toHaveAttribute("href", "/chapters/11");
});
test("Chapter 11 has a complete pre-made deck and vocabulary can be saved from its table", async ({ page, request }) => {
  const deck = await request.get("/flashcard-decks/chapter-11");
  expect(deck.ok()).toBe(true);
  const payload = await deck.json();
  expect(payload.key).toBe("chapter:11"); expect(payload.drafts.length).toBe(142);
  expect(payload.drafts.some((d: {japanese:string}) => d.japanese === "こられる")).toBe(true);
  await page.goto("/chapters/11#vocab");
  const row = visibleMain(page).locator("#vocab table tbody tr").first();
  await row.getByRole("button",{name:/^Add to flashcards/}).click();
  await expect(row.getByRole("button",{name:/^Saved to flashcards/})).toBeDisabled();
  await page.goto("/flashcards");
  await expect(visibleMain(page).getByRole("checkbox",{name:/^Chapter 11 —/})).toBeVisible();
});
test("typed checks ignore IME confirmation and accept ordinary Enter afterwards", async ({ page }) => {
  await page.goto("/chapters/11#c11-potential-forms");
  const item = question(page,"c11-potential-forms-1"), input = item.getByRole("textbox");
  await input.fill("きけます");
  await input.dispatchEvent("keydown",{key:"Enter",code:"Enter",isComposing:true,keyCode:229});
  await expect(item.locator("[data-workbook-feedback]")).toHaveCount(0);
  await input.press("Enter");
  await expect(item.locator("[data-workbook-feedback]")).toContainText("Correct");
});
for (const width of [320,375]) test(width + "px: questions, word tiles, readings and inputs fit",async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/chapters/11#c11-change-choices");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const choice = question(page,"c11-change-choices-1").locator("label").first();
  expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await choice.click();
  await question(page,"c11-change-choices-1").getByRole("button",{name:"Check answer",exact:true}).click();
  await expect(question(page,"c11-change-choices-1").locator("[data-workbook-feedback]")).toContainText("Incorrect");
  await page.goto("/chapters/11#c11-word-order");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(question(page,"c11-word-order-1").locator("[data-workbook-tiles]")).toBeVisible();
});
test("book kanji show furigana in lessons, workbook questions and model answers, but not in headings", async ({ page }) => {
  await page.goto("/chapters/11");
  const main = visibleMain(page);
  const example = main.locator("#lessons tr", { hasText: "なりました" }).first();
  await expect(example.locator("rt").first()).toHaveText("しゃいん");
  await expect(main.locator("#lessons h3 ruby, #exercises h3 ruby, #answers h3 ruby")).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "ぶんけい 11.2 Verb of Change なる" })).toBeVisible();
  const item = question(page, "c11-potential-sentences-3");
  await expect(item.locator("rt")).toHaveText(["かんじ", "か"]);
  await item.getByRole("textbox", { name: "Your answer", exact: true }).fill("かんじが かけます");
  await item.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(item.locator("[data-workbook-feedback] rt")).toHaveText(["かんじ", "か"]);
  await expect(item.locator("[data-workbook-why]")).toBeVisible();
  await page.goto("/chapters/10");
  await expect(visibleMain(page).locator("#lessons ruby")).toHaveCount(0);
});
