import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, library, visibleMain, offsetFromAnchorTarget, type Page } from "./fixtures";

type Target = [href: string, anchor: string | null, label: string | null];
const legacy = JSON.parse(readFileSync(join(__dirname, "../src/data/legacy-links.json"), "utf8")) as Record<
  string,
  { to: Target; anchors: Record<string, Target> }
>;

const desktop = { width: 1440, height: 900 };
const phone = { width: 375, height: 800 };

const outline = (page: Page) =>
  page.locator("aside").getByRole("navigation", { name: "On this page" });

test.describe("readers", () => {
  test.use({ viewport: desktop });

  for (const { path, crumbs, title } of [
    { path: "/chapters/3", crumbs: ["Home", "Chapters", "Chapter 3"], title: /./ },
    { path: "/kana/1", crumbs: ["Home", "Kana", "Kana 1"], title: "Hiragana and Katakana" },
    { path: "/kanji/1", crumbs: ["Home", "Kanji", "Kanji 1"], title: /./ },
    { path: "/kanji/2", crumbs: ["Home", "Kanji", "Kanji 2"], title: library.kanji[1].title },
  ]) {
    test(`${path}: one main, one h1, breadcrumbs, outline`, async ({ page }) => {
      await page.goto(path);
      await expect(visibleMain(page)).toHaveCount(1);
      await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText(title);
      const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(breadcrumb.getByRole("listitem")).toHaveText(crumbs.map((c) => new RegExp(c.replace(/[()]/g, "\\$&"))));
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(crumbs.at(-1)!);
      await expect(outline(page)).toBeVisible();
    });
  }

  test("/kana/1: the 118-entry outline is grouped under 5 sections", async ({ page }) => {
    await page.goto("/kana/1");
    const nav = outline(page);
    const groups = nav.locator(":scope > ul > li");
    await expect(groups).toHaveCount(5);
    await expect(groups.locator(":scope > a")).toHaveText(["Lessons", "Vocabulary", "Easy to mix up", "Exercises", "Answer key"]);
    await expect(nav.locator("details a")).toHaveCount(118);
    await expect(nav.getByRole("link").filter({ visible: true })).toHaveCount(5);

    const lessons = groups.first();
    await lessons.locator("details > summary").click();
    await expect(lessons.locator("details")).toHaveAttribute("open", "");
    await expect(lessons.locator("details a").first()).toBeVisible();
  });

  test("/practice/1 opens the combined checkpoint without the static answer tables", async ({ page }) => {
    await page.goto("/practice/1");
    await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText("Chapter 5 checkpoint");
    await expect(visibleMain(page)).toContainText("0 / 54 answered");
    await expect(visibleMain(page).locator("[data-checkpoint-question]")).toHaveCount(40);
    await expect(visibleMain(page).locator("table, [data-checkpoint-feedback]")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Checkpoints", exact: true })).toHaveAttribute("href", "/checkpoints");
  });

  test("/kanji/2: 30 kanji and the self-test, with model answers", async ({ page }) => {
    await page.goto("/kanji/2");
    const main = visibleMain(page);
    await expect(main.locator("#lessons h3").filter({ hasText: /^. \(/ })).toHaveCount(30);
    await expect(main.locator("#exercises h3").filter({ hasText: /^Part [A-J]:/ })).toHaveCount(10);
    await expect(main.locator("#answers")).toContainText("They are model answers, not the official answer key.");
  });

  test("Chapter 3 has the Kim and Ben dialogue as supplemental reading", async ({ page }) => {
    await page.goto("/chapters/3");
    const nav = outline(page);
    await expect(nav.locator('a[href="#c3-3-10-supplemental-reading-kim-and-ben"]')).toHaveCount(1);
    await expect(visibleMain(page).locator("#c3-3-10-supplemental-reading-kim-and-ben")).toBeAttached();
  });

  test("breadcrumbs go to real destinations", async ({ page }) => {
    await page.goto("/kanji/1");
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await breadcrumb.getByRole("link", { name: "Kanji" }).click();
    await expect(page).toHaveURL("/#kanji");
    // Kana and Kanji share one section; #kanji is the first Kanji card
    await expect(page.locator("#kanji")).toBeInViewport();
    await expect(page.locator("#kanji").getByRole("link")).toHaveAttribute("href", "/kanji/1");

    await page.goto("/practice/1");
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Checkpoints", exact: true }).click();
    await expect(page).toHaveURL("/checkpoints");
  });

  // One page each: these pages take several seconds to load on CI, and
  // together they ran past a single test's 30s timeout
  test.describe("chapter previous and next", () => {
    const pager = (page: Page) => visibleMain(page).getByRole("navigation", { name: "Chapter pages" }).getByRole("link");

    test("the first chapter links to the next one", async ({ page }) => {
      await page.goto("/chapters/1");
      await expect(pager(page)).toHaveCount(1);
      await expect(pager(page)).toHaveAttribute("href", "/chapters/2");
      await pager(page).click();
      await expect(page).toHaveURL("/chapters/2");
      await expect(pager(page)).toHaveCount(2);
    });

    test("a middle chapter links both ways", async ({ page }) => {
      await page.goto("/chapters/10");
      await expect(pager(page)).toHaveCount(2);
      await expect(pager(page).nth(0)).toHaveAttribute("href", "/chapters/9");
      await expect(pager(page).nth(1)).toHaveAttribute("href", "/chapters/11");
    });

    test("the last chapter links to the previous one", async ({ page }) => {
      await page.goto("/chapters/15");
      await expect(pager(page)).toHaveCount(1);
      await expect(pager(page)).toHaveAttribute("href", "/chapters/14");
    });

    test("kana pages have no pager", async ({ page }) => {
      await page.goto("/kana/1");
      await expect(visibleMain(page).getByRole("navigation", { name: "Kana pages" }).getByRole("link")).toHaveCount(0);
    });
  });

  test("desktop outline links jump below the header; Back and Forward follow fragments", async ({ page }) => {
    await page.goto("/chapters/4");
    const nav = outline(page);
    await nav.getByRole("link", { name: "Vocabulary", exact: true }).click();
    await expect(page).toHaveURL("/chapters/4#vocab");
    await expect.poll(() => offsetFromAnchorTarget(page, "vocab")).toBeLessThanOrEqual(1);

    const group = nav.locator(":scope > ul > li").nth(3);
    await group.locator("details > summary").click();
    const child = group.locator("details a").first();
    const href = (await child.getAttribute("href"))!;
    await child.click();
    await expect(page).toHaveURL("/chapters/4" + href);
    await expect.poll(() => offsetFromAnchorTarget(page, href.slice(1))).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL("/chapters/4#vocab");
    await page.goForward();
    await expect(page).toHaveURL("/chapters/4" + href);
  });

  // Direct #anchor links rely on the content being in the first HTML, not
  // streamed in after a placeholder
  test("reader pages arrive complete in the first HTML", async ({ request }) => {
    for (const [path, anchor] of [["/kanji/2", "c2-seasons"], ["/chapters/2", "vocab"], ["/kana/1", "answers"]]) {
      const html = await (await request.get(path)).text();
      expect(html, path).toContain(`id="${anchor}"`);
      expect(html, path).not.toContain('aria-busy="true"');
    }
  });

  test("a direct fragment URL lands on its heading", async ({ page }) => {
    await page.goto("/kanji/2#c2-seasons");
    await expect.poll(() => offsetFromAnchorTarget(page, "c2-seasons")).toBeLessThanOrEqual(1);
  });

  test.describe("phone", () => {
    test.use({ viewport: phone });

    test("outline disclosure opens, groups open, links jump", async ({ page }) => {
      await page.goto("/kana/1");
      const box = visibleMain(page).locator("details").filter({ has: page.getByText("On this page") }).first();
      const summary = box.locator(":scope > summary");
      await expect(summary).toContainText("On this page");
      await expect(box).not.toHaveAttribute("open", "");
      await summary.click();
      await expect(box).toHaveAttribute("open", "");
      const nav = box.getByRole("navigation", { name: "On this page" });
      await nav.locator(":scope > ul > li").first().locator("details > summary").click();
      const link = nav.locator("details a").nth(2);
      const href = (await link.getAttribute("href"))!;
      await link.click();
      await expect(page).toHaveURL("/kana/1" + href);
      await expect.poll(() => offsetFromAnchorTarget(page, href.slice(1))).toBe(0);
    });
  });
});

test.describe("missing pages", () => {
  // With Cache Components a missing dynamic page can stream with status 200 or 404
  test.use({ allowedStatuses: [404] });

  for (const path of ["/chapters/99", "/kana/2", "/kanji/abc", "/kanji/5", "/practice/2", "/lessons/abc", "/lessons/21"]) {
    test(`${path} shows the not found page`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Page not found", level: 1 })).toBeVisible();
    });
  }
});

test.describe("old document links", () => {
  test.use({ viewport: desktop });

  // Each old address, with and without a heading, and where it should land
  const cases: [string, string][] = [
    ["/lessons/1#d1-question-words", legacy["1"].anchors["d1-question-words"][0]],
    ["/lessons/18#d18-cheat-sheet-seasons", "/kanji/2#c2-seasons"],
    ["/lessons/3#d3-passage-2", legacy["3"].anchors["d3-passage-2"][0]],
    ["/lessons/20", "/chapters/3#c3-3-10-supplemental-reading-kim-and-ben"],
    ["/lessons/3", "/practice/1"],
    ["/lessons/12#no-such-heading", "/kanji/1"],
    ["/lessons/2", "/chapters/1#vocab"],
  ];
  for (const [from, to] of cases) {
    test(`${from} lands on ${to}`, async ({ page }) => {
      await page.goto("/");
      await page.goto(from);
      await expect(page).toHaveURL(to);
      const anchor = to.split("#")[1];
      if (anchor) await expect.poll(() => offsetFromAnchorTarget(page, anchor)).toBeLessThanOrEqual(1);
      else await expect(visibleMain(page).getByRole("heading", { level: 1 })).not.toHaveText("This page has moved");
      // the old address is replaced, so Back skips it
      await page.goBack();
      await expect(page).toHaveURL("/");
    });
  }

  test("every old document address sends you on", async ({ page }) => {
    for (const [n, { to }] of Object.entries(legacy)) {
      await page.goto(`/lessons/${n}`);
      await expect(page, `/lessons/${n}`).toHaveURL(to[0]);
    }
  });

  test("the old address keeps a plain link and none of the old content", async ({ request }) => {
    const html = await (await request.get("/lessons/1")).text();
    expect(html).toContain("This page has moved");
    expect(html).toContain('href="/chapters/1"');
    expect(html).not.toContain('id="d1-');
    expect(html).not.toContain("<table");
  });
});
