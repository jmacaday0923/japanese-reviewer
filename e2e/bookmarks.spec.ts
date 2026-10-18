import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, library, visibleMain, offsetFromAnchorTarget, type Page } from "./fixtures";

// Bookmarks and "Continue studying". Each test starts with empty storage
// (Playwright gives every test a fresh browser context). Every test also
// fails on hydration errors and other console errors, through the shared
// browserProblems fixture.

const KEY = "japanese-reviewer:study";
const { chapters, kanji, practice } = library;
type Target = [href: string, anchor: string | null, label: string | null];
const legacy = JSON.parse(readFileSync(join(__dirname, "../src/data/legacy-links.json"), "utf8")) as Record<
  string,
  { to: Target; anchors: Record<string, Target> }
>;

test.use({ viewport: { width: 1440, height: 900 } });

function reader(page: Page) {
  const main = visibleMain(page);
  return {
    bookmarkPage: main.getByRole("button", { name: "Bookmark page" }),
    bookmarkSection: main.getByRole("button", { name: /^Bookmark section/ }),
    notSavedNote: main.getByText("This browser isn't letting the site save"),
  };
}

function shelf(page: Page) {
  const main = visibleMain(page);
  const card = (name: string) => main.getByRole("heading", { name, level: 3 }).locator("..");
  const bookmarks = card("Bookmarks");
  return {
    resume: card("Continue studying"),
    bookmarksHeading: main.getByRole("heading", { name: /^Bookmarks/, level: 3 }),
    bookmarks,
    items: bookmarks.getByRole("listitem"),
    notSavedNote: main.getByText("This browser isn't letting the site save"),
  };
}

async function saveRaw(page: Page, raw: string) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, raw]);
}

async function readSaved(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), KEY);
}

test("a first visit shows empty states and an unpressed button", async ({ page }) => {
  await page.goto("/");
  const s = shelf(page);
  await expect(s.resume).toContainText("Open any chapter, kana, kanji or practice page");
  await expect(s.bookmarks).toContainText("No bookmarks yet");
  await expect(s.items).toHaveCount(0);

  await page.goto("/chapters/1");
  const r = reader(page);
  await expect(r.bookmarkPage).toBeEnabled();
  await expect(r.bookmarkPage).toHaveAttribute("aria-pressed", "false");
  await expect(r.bookmarkSection).toHaveCount(0); // no #section in the address
  await expect(r.notSavedNote).toHaveCount(0);
});

test("bookmark a page: it stays after a reload, shows on the dashboard, opens, and can be removed", async ({ page }) => {
  await page.goto("/chapters/3");
  const r = reader(page);
  await r.bookmarkPage.focus();
  await page.keyboard.press("Space");
  await expect(r.bookmarkPage).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(r.bookmarkPage).toHaveAttribute("aria-pressed", "true");
  expect(await readSaved(page)).toMatchObject({
    version: 1,
    bookmarks: [{ kind: "chapter", id: "3", anchor: null, section: null }],
  });

  await page.goto("/");
  const s = shelf(page);
  await expect(s.items).toHaveCount(1);
  await expect(s.bookmarksHeading).toHaveText("Bookmarks (1)");
  const link = s.items.first().getByRole("link");
  await expect(link).toHaveAttribute("href", "/chapters/3");
  await expect(link).toContainText("Chapter 3");
  await expect(link).toContainText(chapters[2].title);

  await link.click();
  await expect(page).toHaveURL("/chapters/3");
  await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText(chapters[2].title);
  await page.goBack();

  await s.items.first().getByRole("button", { name: `Remove bookmark: ${chapters[2].title}` }).click();
  await expect(s.items).toHaveCount(0);
  await expect(s.bookmarks).toContainText("No bookmarks yet");
  await expect(s.bookmarksHeading).toBeFocused();
  expect((await readSaved(page)).bookmarks).toEqual([]);

  // pressing again on the reader removes it there too
  await page.goto("/chapters/3");
  await expect(r.bookmarkPage).toHaveAttribute("aria-pressed", "false");
});

test("bookmark a section after jumping to it from the outline", async ({ page }) => {
  await page.goto("/kana/1");
  const r = reader(page);
  await page.locator("aside").getByRole("link", { name: "Vocabulary", exact: true }).click();
  await expect(page).toHaveURL("/kana/1#vocab");
  await expect(r.bookmarkSection).toHaveText("Bookmark section: Vocabulary");
  await r.bookmarkSection.click();
  await expect(r.bookmarkSection).toHaveAttribute("aria-pressed", "true");
  await expect(r.bookmarkPage).toHaveAttribute("aria-pressed", "false"); // the page itself isn't bookmarked

  // Back to the top of the page: no section, so no section button
  await page.goBack();
  await expect(page).toHaveURL("/kana/1");
  await expect(r.bookmarkSection).toHaveCount(0);

  await visibleMain(page).getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" }).click();
  const s = shelf(page);
  const link = s.items.first().getByRole("link");
  await expect(link).toHaveAttribute("href", "/kana/1#vocab");
  await expect(link).toContainText("Kana 1 · Hiragana and Katakana");
  await expect(link).toContainText("Vocabulary");

  await link.click();
  await expect(page).toHaveURL("/kana/1#vocab");
  await expect.poll(() => offsetFromAnchorTarget(page, "vocab")).toBeLessThanOrEqual(1);
  await expect(r.bookmarkSection).toHaveAttribute("aria-pressed", "true");
});

test("only anchors from the page's outline can be bookmarked as sections", async ({ page }) => {
  await page.goto("/kana/1#not-a-heading");
  const r = reader(page);
  await expect(r.bookmarkPage).toBeEnabled();
  await expect(r.bookmarkSection).toHaveCount(0);
});

test("continue studying shows the last page and section opened", async ({ page }) => {
  await page.goto("/kanji/2#c2-seasons");
  await expect(reader(page).bookmarkSection).toHaveText("Bookmark section: Seasons");
  await expect.poll(async () => (await readSaved(page))?.lastVisit).toMatchObject({ kind: "kanji", id: "2", anchor: "c2-seasons" });
  await page.goto("/");
  let link = shelf(page).resume.getByRole("link");
  await expect(link).toHaveAttribute("href", "/kanji/2#c2-seasons");
  await expect(link).toContainText(kanji[1].title);
  await expect(link).toContainText("Seasons");

  await link.click();
  await expect.poll(() => offsetFromAnchorTarget(page, "c2-seasons")).toBeLessThanOrEqual(1);

  await page.goto("/chapters/2");
  // The visit is saved once the page runs in the browser; leave only after that
  await expect.poll(async () => (await readSaved(page))?.lastVisit).toMatchObject({ kind: "chapter", id: "2" });
  await page.goto("/");
  link = shelf(page).resume.getByRole("link");
  await expect(link).toHaveAttribute("href", "/chapters/2");
  await expect(link).toContainText("Chapter 2");
  await expect(link).toContainText(chapters[1].title);
});

test("saved data shows right away with no hydration errors", async ({ page }) => {
  await page.goto("/");
  await saveRaw(
    page,
    JSON.stringify({
      version: 1,
      bookmarks: [
        { kind: "kanji", id: "1", anchor: null, section: null, savedAt: 2 },
        { kind: "chapter", id: "3", anchor: "vocab", section: "Vocabulary", savedAt: 1 },
      ],
      lastVisit: { kind: "chapter", id: "5", anchor: null, section: null, visitedAt: 3 },
    })
  );
  await page.reload();
  const s = shelf(page);
  await expect(s.items).toHaveCount(2);
  await expect(s.items.nth(0).getByRole("link")).toHaveAttribute("href", "/kanji/1");
  await expect(s.items.nth(1).getByRole("link")).toHaveAttribute("href", "/chapters/3#vocab");
  await expect(s.resume.getByRole("link")).toHaveAttribute("href", "/chapters/5");

  await page.goto("/chapters/3#vocab");
  const r = reader(page);
  await expect(r.bookmarkSection).toHaveAttribute("aria-pressed", "true");
  await expect(r.bookmarkPage).toHaveAttribute("aria-pressed", "false");
});

test.describe("damaged or old saved data", () => {
  for (const [name, raw] of [
    ["not JSON", "{not json"],
    ["an unknown version", JSON.stringify({ version: 99, bookmarks: [{ kind: "chapter", id: "1" }] })],
    ["the wrong shape", JSON.stringify(["chapter", 1])],
  ]) {
    test(`${name}: starts empty, then saves a good copy`, async ({ page }) => {
      await page.goto("/");
      await saveRaw(page, raw);
      await page.reload();
      const s = shelf(page);
      await expect(s.bookmarks).toContainText("No bookmarks yet");
      await expect(s.resume).toContainText("Open any chapter");

      await page.goto("/chapters/1");
      await reader(page).bookmarkPage.click();
      await expect(reader(page).bookmarkPage).toHaveAttribute("aria-pressed", "true");
      expect(await readSaved(page)).toMatchObject({ version: 1, bookmarks: [{ kind: "chapter", id: "1" }] });
    });
  }

  test("bad entries and pages that no longer exist are skipped, good ones kept", async ({ page }) => {
    await page.goto("/");
    await saveRaw(
      page,
      JSON.stringify({
        version: 1,
        bookmarks: [
          { kind: "chapter", id: "99", anchor: null, section: null, savedAt: 4 }, // no such page
          { kind: "chapter", id: "2", anchor: "<script>", section: "x", savedAt: 3 }, // not an anchor id
          "junk",
          { kind: "kana", id: "1", anchor: "answers", section: "Answer key", savedAt: 1 },
        ],
        lastVisit: { kind: "lesson", id: "999", anchor: null, section: null, visitedAt: 1 },
      })
    );
    await page.reload();
    const s = shelf(page);
    await expect(s.items).toHaveCount(1);
    await expect(s.items.getByRole("link")).toHaveAttribute("href", "/kana/1#answers");
    await expect(s.resume).toContainText("Open any chapter");
  });

  // Regression: a section removed from the data used to keep its old label and a dead #link
  test("a saved section that no longer exists opens its page, without the old label", async ({ page }) => {
    await page.goto("/");
    await saveRaw(
      page,
      JSON.stringify({
        version: 1,
        bookmarks: [
          { kind: "chapter", id: "3", anchor: "removed-heading", section: "Old heading", savedAt: 2 },
          { kind: "kana", id: "1", anchor: "vocab", section: "Vocabulary", savedAt: 1 },
        ],
        lastVisit: { kind: "lesson", id: "1", anchor: "gone-too", section: "Old section", visitedAt: 3 },
      })
    );
    await page.reload();
    const s = shelf(page);
    await expect(s.items).toHaveCount(2);

    const stale = s.items.nth(0);
    await expect(stale.getByRole("link")).toHaveAttribute("href", "/chapters/3");
    await expect(stale.getByRole("link")).toContainText(chapters[2].title);
    await expect(stale.getByRole("link")).toContainText("The saved section is no longer on this page");
    await expect(stale).not.toContainText("Old heading");

    // a valid section is untouched
    await expect(s.items.nth(1).getByRole("link")).toHaveAttribute("href", "/kana/1#vocab");
    await expect(s.items.nth(1).getByRole("link")).toContainText("Vocabulary");
    await expect(s.items.nth(1)).not.toContainText("no longer on this page");

    // an old document visit with a heading the map doesn't know moves to that document's page
    const resume = s.resume.getByRole("link");
    await expect(resume).toHaveAttribute("href", "/chapters/1");
    await expect(resume).toContainText(chapters[0].title);
    await expect(s.resume).not.toContainText("Old section");
    await expect.poll(async () => (await readSaved(page)).lastVisit).toMatchObject({ kind: "chapter", id: "1", anchor: null, section: null });

    // Remove takes out the saved bookmark, anchor and all; storage keeps its format
    await stale.getByRole("button", { name: `Remove bookmark: ${chapters[2].title}` }).click();
    await expect(s.items).toHaveCount(1);
    expect((await readSaved(page)).bookmarks).toEqual([{ kind: "kana", id: "1", anchor: "vocab", section: "Vocabulary", savedAt: 1 }]);

    await resume.click();
    await expect(page).toHaveURL("/chapters/1");
    await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText(chapters[0].title);
  });
});

test("bookmarks saved on the old document pages move to the study pages", async ({ page }) => {
  await page.goto("/");
  const questionWords = legacy["1"].anchors["d1-question-words"];
  const shopSign = legacy["3"].anchors["d3-passage-2"];
  await saveRaw(
    page,
    JSON.stringify({
      version: 1,
      bookmarks: [
        { kind: "lesson", id: "1", anchor: "d1-question-words", section: "Question words", savedAt: 6 },
        { kind: "lesson", id: "18", anchor: "d18-cheat-sheet-seasons", section: "Seasons", savedAt: 5 },
        // the same place, saved again on the new page: kept once
        { kind: "chapter", id: "1", anchor: questionWords[1], section: questionWords[2], savedAt: 4 },
        { kind: "lesson", id: "99", anchor: null, section: null, savedAt: 3 }, // no such document
        { kind: "lesson", id: "3", anchor: null, section: null, savedAt: 2 },
        { kind: "chapter", id: "5", anchor: null, section: null, savedAt: 1 },
      ],
      lastVisit: { kind: "lesson", id: "3", anchor: "d3-passage-2", section: "Passage 2", visitedAt: 7 },
    })
  );
  await page.reload();
  const s = shelf(page);
  await expect(s.items.getByRole("link")).toHaveCount(4);
  const links = s.items.getByRole("link");
  await expect(links.nth(0)).toHaveAttribute("href", questionWords[0]);
  await expect(links.nth(0)).toContainText(questionWords[2]!);
  await expect(links.nth(1)).toHaveAttribute("href", "/kanji/2#c2-seasons");
  await expect(links.nth(1)).toContainText(kanji[1].title);
  await expect(links.nth(2)).toHaveAttribute("href", "/practice/1");
  await expect(links.nth(2)).toContainText(practice[0].title);
  await expect(links.nth(3)).toHaveAttribute("href", "/chapters/5");
  await expect(s.resume.getByRole("link")).toHaveAttribute("href", shopSign[0]);
  await expect(s.resume.getByRole("link")).toContainText(shopSign[2]!);

  // saved in the new form, so it happens once
  await expect.poll(async () => JSON.stringify(await readSaved(page))).not.toContain('"lesson"');
  const saved = await readSaved(page);
  expect(saved.bookmarks.map((b: { savedAt: number }) => b.savedAt)).toEqual([6, 5, 2, 1]);
  expect(saved.lastVisit).toMatchObject({ kind: "practice", id: "1", anchor: shopSign[1], section: shopSign[2], visitedAt: 7 });
  await page.reload();
  await expect(shelf(page).items.getByRole("link")).toHaveCount(4);

  // the moved bookmark is the one the page's button shows
  await links.nth(1).click();
  await expect(page).toHaveURL("/kanji/2#c2-seasons");
  await expect(reader(page).bookmarkSection).toHaveAttribute("aria-pressed", "true");
});

test.describe("storage the browser won't allow", () => {
  // Regression: losing access after the first read used to empty the dashboard
  test("blocked after loading: what was already read stays, and new bookmarks still work", async ({ page }) => {
    await page.goto("/");
    await saveRaw(page, JSON.stringify({
      version: 1,
      bookmarks: [{ kind: "chapter", id: "4", anchor: null, section: null, savedAt: 1 }],
      lastVisit: null,
    }));
    await page.reload();
    const s = shelf(page);
    await expect(s.items.getByRole("link")).toHaveAttribute("href", "/chapters/4");

    // Make every read fail from now on, then make the page read again (as another tab's change would)
    await page.evaluate((key) => {
      Storage.prototype.getItem = () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      };
      window.dispatchEvent(new StorageEvent("storage", { key }));
    }, KEY);
    await expect(s.notSavedNote).toBeVisible();
    await expect(s.items).toHaveCount(1);
    await expect(s.items.getByRole("link")).toHaveAttribute("href", "/chapters/4");

    await s.items.getByRole("link").click();
    await expect(page).toHaveURL("/chapters/4");
    const r = reader(page);
    await expect(r.bookmarkPage).toHaveAttribute("aria-pressed", "true");
    await visibleMain(page).getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Chapters" }).click();
    await expect(s.items).toHaveCount(1);
    await expect(s.resume.getByRole("link")).toHaveAttribute("href", "/chapters/4");
  });

  test("blocked localStorage: no errors, bookmarks work until the tab closes", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    });
    await page.goto("/chapters/1");
    const r = reader(page);
    await expect(r.notSavedNote).toBeVisible();
    await r.bookmarkPage.click();
    await expect(r.bookmarkPage).toHaveAttribute("aria-pressed", "true");

    // A link click keeps the same tab and memory
    await visibleMain(page).getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" }).click();
    const s = shelf(page);
    await expect(s.items.getByRole("link")).toHaveAttribute("href", "/chapters/1");
    await expect(s.resume.getByRole("link")).toHaveAttribute("href", "/chapters/1");
    await expect(s.notSavedNote).toBeVisible();
  });

  test("full storage: the bookmark still works and the page says it isn't saved", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      };
    });
    await page.goto("/chapters/1");
    const r = reader(page);
    await r.bookmarkPage.click();
    await expect(r.bookmarkPage).toHaveAttribute("aria-pressed", "true");
    await expect(r.notSavedNote).toBeVisible();
  });
});

test("a bookmark added in another tab shows up without a reload", async ({ page, context }) => {
  await page.goto("/");
  const s = shelf(page);
  await expect(s.items).toHaveCount(0);

  const other = await context.newPage();
  await other.goto("/chapters/2");
  await reader(other).bookmarkPage.click();
  await expect(reader(other).bookmarkPage).toHaveAttribute("aria-pressed", "true");
  await other.close();

  await expect(s.items.getByRole("link")).toHaveAttribute("href", "/chapters/2");
  await expect(s.resume.getByRole("link")).toHaveAttribute("href", "/chapters/2");
});
