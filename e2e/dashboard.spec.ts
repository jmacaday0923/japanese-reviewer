import { test, expect, index, library, search, visibleMain, type Page } from "./fixtures";
import checkpoints from "../src/data/checkpoint-exams.json";
import { categoryLabel, searchGroups } from "../src/lib/search";

// The dashboard's layout and the parts added with the blue redesign: the
// grouped navigation and toolbar, stats from the data, the Practice section,
// the search shortcut and the Last opened badge.

const { chapters, kana, kanji } = library;

test.use({ viewport: { width: 1440, height: 900 } });

// Reader pages save the visit once they're running in the browser; wait for
// it before leaving, so the dashboard reads the new last visit
async function visit(page: Page, path: string, kind: string, id: string) {
  await page.goto(path);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("japanese-reviewer:study") ?? "null")?.lastVisit))
    .toMatchObject({ kind, id });
}

const top = (page: Page, selector: string) =>
  visibleMain(page).locator(selector).first().evaluate((el) => el.getBoundingClientRect().top);

test("dashboard sections come in order", async ({ page }) => {
  await page.goto("/");
  const order = ["h1", "#overview-heading + dl", "#bookmarks", "#search", "#chapters", "#kana-kanji", "#checkpoints", "#listening"];
  const tops = [];
  for (const selector of order) tops.push(await top(page, selector));
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  // Continue studying and Bookmarks sit side by side on desktop
  const resume = visibleMain(page).getByRole("heading", { name: "Continue studying", level: 3 }).locator("..");
  expect(Math.round(await resume.evaluate((el) => el.getBoundingClientRect().top))).toBe(Math.round(tops[2]));
});

test("stats are counted from the data files", async ({ page }) => {
  await page.goto("/");
  const dl = visibleMain(page).locator("#overview-heading + dl");
  const stat = (label: string) => dl.locator("div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) }).locator("dd");
  await expect(stat("chapters")).toHaveText(String(chapters.length));
  await expect(stat("kana & kanji pages")).toHaveText(String(kana.length + kanji.length));
  await expect(stat("checkpoints")).toHaveText(String(checkpoints.length));
  await expect(stat("searchable entries")).toHaveText(index.entries.length.toLocaleString("en-US"));
  await expect(dl.locator("dt")).toHaveText(["chapters", "kana & kanji pages", "checkpoints", "searchable entries"]);
});

test("the library has chapters, kana, kanji and practice, and no Documents section", async ({ page }) => {
  await page.goto("/");
  const main = visibleMain(page);
  // #kana and #kanji mark each group's first card, inside the shared section
  await expect(main.locator("#chapters article")).toHaveCount(chapters.length);
  await expect(main.locator('#kana-kanji article a[href^="/kana/"]')).toHaveCount(kana.length);
  await expect(main.locator('#kana-kanji article a[href^="/kanji/"]')).toHaveCount(kanji.length);
  const exam = main.locator('#checkpoints a[href="/checkpoints/chapter-5"]');
  await expect(exam).toHaveCount(1);
  await expect(main.getByRole("heading", { name: "Checkpoints", level: 2 })).toBeVisible();
  await expect(main.locator('#practice article')).toHaveCount(0);
  // Kanji 2 is listed with Kanji 1
  await expect(main.locator('#kana-kanji article a[href^="/kanji/"]')).toHaveText(kanji.map((k) => k.title));

  // nothing points at the old documents
  await expect(main.locator("#documents")).toHaveCount(0);
  await expect(main.getByRole("heading", { name: /Documents/ })).toHaveCount(0);
  await expect(page.locator('a[href^="/lessons"]')).toHaveCount(0);

  await exam.click();
  await expect(page).toHaveURL("/checkpoints/chapter-5");
  await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText("Chapter 5 checkpoint");
});

test("sidebar: grouped links, current section, and a working Bookmarks link", async ({ page }) => {
  await page.goto("/chapters/3");
  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByRole("link", { name: "Japanese Lesson Reviewer" })).toHaveAttribute("href", "/");
  const study = sidebar.getByRole("list", { name: "Study" });
  await expect(study.getByRole("link")).toHaveText(["Home", "Chapters", "Kana", "Kanji", "Listening", "Checkpoints"]);
  await expect(study.getByRole("link", { name: "Chapters" })).toHaveAttribute("aria-current", "true");
  await expect(page.locator("body > header")).toContainText("Chapters");

  await sidebar.getByRole("list", { name: "Saved" }).getByRole("link", { name: "Bookmarks" }).click();
  await expect(page).toHaveURL("/#bookmarks");
  await expect(visibleMain(page).getByRole("heading", { name: /^Bookmarks/, level: 3 })).toBeInViewport();
  await expect(sidebar.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("link", { name: "Bookmarks" })).not.toHaveAttribute("aria-current");
});

test("the old practice address belongs to Checkpoints in navigation", async ({ page }) => {
  await page.goto("/practice/1");
  const study = page.locator("aside").first().getByRole("list", { name: "Study" });
  await expect(study.getByRole("link", { name: "Checkpoints", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(page.locator("body > header")).toContainText("Checkpoints");
  await study.getByRole("link", { name: "Checkpoints", exact: true }).click();
  await expect(page).toHaveURL("/checkpoints");
});

test("phone menu has the Saved group too", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/kanji/2");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.locator("#mobile-nav");
  await menu.getByRole("list", { name: "Saved" }).getByRole("link", { name: "Bookmarks" }).click();
  await expect(page).toHaveURL("/#bookmarks");
  await expect(menu).toBeHidden();
  await expect(visibleMain(page).getByRole("heading", { name: /^Bookmarks/, level: 3 })).toBeInViewport();
});

test("Ctrl+K and Cmd+K focus the search, and the hint shows only once that works", async ({ page }) => {
  await page.goto("/");
  const s = search(page);
  await expect(s.box).toBeEnabled();
  await expect(page.locator("#search kbd")).toBeVisible();
  await expect(s.box).toHaveAttribute("aria-keyshortcuts", "Meta+K Control+K");

  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("Control+k");
  await expect(s.box).toBeFocused();

  await s.box.fill("gakkou");
  await expect(page.locator("#search kbd")).toHaveCount(0); // the clear button takes its place
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("Meta+k");
  await expect(s.box).toBeFocused();
  await expect(page).toHaveURL("/?q=gakkou");
});

test("search results show category tags only when not filtered to one", async ({ page }) => {
  await page.goto("/?q=gakkou");
  const s = search(page);
  // Exact vocabulary definitions lead the ranked groups.
  const first = categoryLabel(searchGroups(index, { q: "gakkou", category: "all", chapter: "all" })[0].entry.c);
  await expect(s.results.first().locator("span.rounded-full")).toHaveText(first);
  await s.chip(first).click();
  await expect(s.chip(first)).toHaveAttribute("aria-pressed", "true");
  await expect(s.results.first()).toBeVisible();
  await expect(s.results.first().locator("span.rounded-full")).toHaveCount(0);
});

test("Last opened marks the card Continue studying points to", async ({ page }) => {
  await page.goto("/");
  const main = visibleMain(page);
  await expect(main.getByRole("heading", { name: "Continue studying", level: 3 }).locator("..")).toContainText("Open any chapter");
  await expect(main.getByText("Last opened")).toHaveCount(0);

  await visit(page, "/chapters/7", "chapter", "7");
  await page.goto("/");
  const badge = visibleMain(page).getByText("Last opened", { exact: true });
  await expect(badge).toHaveCount(1);
  const card = visibleMain(page).locator("#chapters article").filter({ has: page.getByText("Last opened", { exact: true }) });
  await expect(card.getByRole("link")).toHaveText(chapters[6].title);

  await visit(page, "/kana/1", "kana", "1");
  await page.goto("/");
  await expect(visibleMain(page).getByText("Last opened", { exact: true })).toHaveCount(1);
  await expect(visibleMain(page).locator("#kana article")).toContainText("Last opened");
});
