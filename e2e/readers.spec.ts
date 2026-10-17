import { test, expect, docs, visibleMain, offsetFromAnchorTarget, type Page } from "./fixtures";

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
    { path: "/lessons/2", crumbs: ["Home", "Documents", docs[1].title], title: docs[1].title },
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

  test("/lessons/20 has no outline and stays one column", async ({ page }) => {
    await page.goto("/lessons/20");
    await expect(visibleMain(page).getByRole("heading", { level: 1 })).toHaveText(docs[19].title);
    await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(0);
    await expect(page.locator("aside").filter({ hasText: "On this page" })).toHaveCount(0);
  });

  test("breadcrumbs go to real destinations", async ({ page }) => {
    await page.goto("/kanji/1");
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await breadcrumb.getByRole("link", { name: "Kanji" }).click();
    await expect(page).toHaveURL("/#kanji");
    await expect(page.getByRole("heading", { name: "Kanji", level: 2 })).toBeInViewport();

    await page.goto("/lessons/5");
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Documents" }).click();
    await expect(page).toHaveURL("/#documents");
  });

  test("chapter previous and next", async ({ page }) => {
    const pager = () => visibleMain(page).getByRole("navigation", { name: "Chapter pages" }).getByRole("link");
    await page.goto("/chapters/1");
    await expect(pager()).toHaveCount(1);
    await expect(pager()).toHaveAttribute("href", "/chapters/2");
    await pager().click();
    await expect(page).toHaveURL("/chapters/2");
    await expect(pager()).toHaveCount(2);
    await page.goto("/chapters/10");
    await expect(pager()).toHaveCount(1);
    await expect(pager()).toHaveAttribute("href", "/chapters/9");
    await page.goto("/kana/1");
    await expect(visibleMain(page).getByRole("navigation", { name: "Kana pages" }).getByRole("link")).toHaveCount(0);
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
    for (const [path, anchor] of [["/lessons/1", "d1-question-words"], ["/chapters/2", "vocab"], ["/kana/1", "answers"]]) {
      const html = await (await request.get(path)).text();
      expect(html, path).toContain(`id="${anchor}"`);
      expect(html, path).not.toContain('aria-busy="true"');
    }
  });

  test("a direct fragment URL lands on its heading", async ({ page }) => {
    await page.goto("/lessons/1#d1-question-words");
    await expect.poll(() => offsetFromAnchorTarget(page, "d1-question-words")).toBeLessThanOrEqual(1);
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

  for (const path of ["/chapters/99", "/kana/2", "/kanji/abc", "/lessons/abc", "/lessons/21"]) {
    test(`${path} shows the not found page`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Page not found", level: 1 })).toBeVisible();
    });
  }
});
