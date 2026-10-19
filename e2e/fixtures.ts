import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { buildSearchIndex, searchGroups, type CategoryFilter } from "../src/lib/search";
import type { Chapter } from "../src/types/lesson";

// Every test fails if the page logs an error, throws, or an app request fails.
// Tests that open a missing page on purpose list the status they expect.
type Fixtures = { allowedStatuses: number[]; browserProblems: string[] };

export const test = base.extend<Fixtures>({
  allowedStatuses: [[], { option: true }],
  browserProblems: [
    async ({ page, baseURL, allowedStatuses }, use) => {
      const problems: string[] = [];
      const origin = new URL(baseURL!).origin;
      page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        // The browser also logs expected 404 responses; those are checked below
        if (allowedStatuses.length && message.text().includes("status of 404")) return;
        problems.push(`console error: ${message.text()}`);
      });
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.origin === origin && response.status() >= 400 && !allowedStatuses.includes(response.status())) {
          problems.push(`HTTP ${response.status()}: ${url.pathname}${url.search}`);
        }
      });
      page.on("requestfailed", (request) => {
        // Prefetches the router cancels on navigation are normal
        if (request.failure()?.errorText === "net::ERR_ABORTED") return;
        problems.push(`request failed: ${request.url()} (${request.failure()?.errorText})`);
      });
      await use(problems);
      expect(problems, "browser errors or failed requests").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

// ---- Data, for expected counts (built the same way as /search-index.json) ----

const load = (file: string) => JSON.parse(readFileSync(join(__dirname, "../src/data", file), "utf8"));
export const library = {
  chapters: load("chapters.json") as Chapter[],
  kana: load("kana.json") as Chapter[],
  kanji: load("kanji.json") as Chapter[],
  practice: load("practice.json") as Chapter[],
};
export const index = buildSearchIndex([
  { kind: "chapter", label: "Chapter", basePath: "/chapters", pages: library.chapters },
  { kind: "kana", label: "Kana", basePath: "/kana", pages: library.kana },
  { kind: "kanji", label: "Kanji", basePath: "/kanji", pages: library.kanji },
  { kind: "practice", label: "Practice", basePath: "/practice", pages: library.practice },
]);

export function expectedCount(q: string, category = "all", chapter = "all") {
  return searchGroups(index, { q, category: category as CategoryFilter, chapter }).length;
}

export function statusText(count: number, shown = 50) {
  if (count === 0) return "No results";
  return `${count.toLocaleString("en-US")} ${count === 1 ? "result" : "results"}${count > shown ? ` (showing ${shown})` : ""}`;
}

// ---- Locators ----

// Next.js keeps recently visited pages in the DOM, hidden, so scope to what's visible
export const visibleMain = (page: Page) => page.locator("main:visible");

export function search(page: Page) {
  const section = page.locator("#search");
  return {
    box: section.getByRole("searchbox", { name: "Search lessons" }),
    chip: (name: string) => section.getByRole("button", { name, exact: true }),
    chapter: section.getByRole("combobox", { name: "Filter by chapter" }),
    status: section.locator('[aria-live="polite"]'),
    results: section.getByRole("listitem"),
    showMore: section.getByRole("button", { name: /^Show more/ }),
    clear: section.getByRole("button", { name: "Clear search text" }),
    reset: section.getByRole("button", { name: "Reset search" }),
  };
}

// How far (in px) an element is from where anchor jumps should put it,
// just below the sticky header (the page's scroll-padding-top)
export async function offsetFromAnchorTarget(page: Page, id: string) {
  return page.evaluate((target) => {
    const el = [...document.querySelectorAll(`[id="${CSS.escape(target)}"]`)].find((e) => e.checkVisibility());
    if (!el) return Number.NaN;
    const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    return Math.abs(Math.round(el.getBoundingClientRect().top - padding));
  }, id);
}
export type { Page } from "@playwright/test";
