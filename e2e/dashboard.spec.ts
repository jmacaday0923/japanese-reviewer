import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, docs, search, visibleMain, type Page } from "./fixtures";

// The dashboard's layout and the parts added with the blue redesign: the
// grouped navigation and toolbar, stats from the data, document tags, the
// search shortcut and the Last opened badge.

const load = (file: string) => JSON.parse(readFileSync(join(__dirname, "../src/data", file), "utf8"));
const chapters = load("chapters.json") as { ch: string; title: string }[];
const kana = load("kana.json") as unknown[];
const kanji = load("kanji.json") as unknown[];
const items = load("lesson-data.json").items as { d: number; c: string }[];

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
  const order = ["h1", "#overview-heading + dl", "#bookmarks", "#search", "#chapters", "#kana-kanji", "#documents"];
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
  await expect(stat("documents")).toHaveText(String(docs.length));
  await expect(stat("searchable entries")).toHaveText(items.length.toLocaleString("en-US"));
});

test("every document is listed with tags from its own entries", async ({ page }) => {
  await page.goto("/");
  const rows = visibleMain(page).locator("#documents li");
  await expect(rows).toHaveCount(docs.length);

  const labels: Record<string, string> = {
    grammar: "Grammar",
    vocab: "Vocabulary",
    script: "Kana & Kanji",
    practice: "Practice",
    answers: "Answers",
  };
  for (const [i, doc] of docs.entries()) {
    const own = new Set(items.filter((item) => item.d === doc.n).map((item) => item.c));
    const expected = Object.keys(labels).filter((c) => own.has(c)).map((c) => labels[c]);
    const row = rows.nth(i);
    await expect(row.getByRole("link")).toHaveText(doc.title);
    await expect(row.getByRole("link")).toHaveAttribute("href", `/lessons/${doc.n}`);
    await expect(row.locator("span.rounded-full")).toHaveText(expected);
  }
  // The first reviewer covers three kinds of content
  await expect(rows.first().locator("span.rounded-full")).toHaveText(["Grammar", "Vocabulary", "Practice"]);

  // The whole row opens the document
  await rows.nth(4).click({ position: { x: 900, y: 20 } });
  await expect(page).toHaveURL(`/lessons/${docs[4].n}`);
});

test("sidebar: grouped links, current section, and a working Bookmarks link", async ({ page }) => {
  await page.goto("/chapters/3");
  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByRole("link", { name: "Japanese Lesson Reviewer" })).toHaveAttribute("href", "/");
  const study = sidebar.getByRole("list", { name: "Study" });
  await expect(study.getByRole("link")).toHaveText(["Home", "Chapters", "Kana", "Kanji", "Documents"]);
  await expect(study.getByRole("link", { name: "Chapters" })).toHaveAttribute("aria-current", "true");
  await expect(page.locator("body > header")).toContainText("Chapters");

  await sidebar.getByRole("list", { name: "Saved" }).getByRole("link", { name: "Bookmarks" }).click();
  await expect(page).toHaveURL("/#bookmarks");
  await expect(visibleMain(page).getByRole("heading", { name: /^Bookmarks/, level: 3 })).toBeInViewport();
  await expect(sidebar.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("link", { name: "Bookmarks" })).not.toHaveAttribute("aria-current");
});

test("phone menu has the Saved group too", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/lessons/2");
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
  await expect(s.results.first().locator("span.rounded-full")).toHaveText("Vocabulary");
  await s.chip("Vocabulary").click();
  await expect(s.chip("Vocabulary")).toHaveAttribute("aria-pressed", "true");
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
