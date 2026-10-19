import { test, expect, expectedCount, statusText, search, offsetFromAnchorTarget } from "./fixtures";

test.describe("search", () => {
  test("exact student definition leads, repeated locations expand and open at their heading", async ({ page }) => {
    await page.goto("/?q=gakusei");
    const s = search(page);
    await expect(s.status).toHaveText(statusText(expectedCount("gakusei")));
    const first = s.results.first();
    await expect(first).toContainText("学生");
    await expect(first).toContainText("student");
    await expect(first.getByRole("link")).toHaveAttribute("href", "/chapters/1#c1-people-and-jobs");
    const summary = first.locator("summary");
    await expect(summary).toHaveText("Also in 1 other location");
    await summary.focus();
    await page.keyboard.press("Enter");
    const other = first.getByRole("link", { name: /Kana 1/ });
    await expect(other).toBeVisible();
    const href = (await other.getAttribute("href"))!;
    expect(href).toBe("/kana/1#c1-people-and-family");
    await other.click();
    await expect(page).toHaveURL(href);
    await expect.poll(() => offsetFromAnchorTarget(page, href.split("#")[1])).toBeLessThanOrEqual(1);
    await page.goBack();
    await expect(s.status).toHaveText(statusText(expectedCount("gakusei")));
  });

  test("romaji, kana, kanji and English all put the same exact definition first", async ({ page }) => {
    for (const q of ["ＧＡＫＵＳＥＩ", "がくせい", "学生", "student"]) {
      await page.goto("/?q=" + encodeURIComponent(q));
      const first = search(page).results.first();
      await expect(first).toContainText("学生");
      await expect(first.getByRole("link")).toHaveAttribute("href", "/chapters/1#c1-people-and-jobs");
    }
  });

  test("source groups respect category and chapter filters", async ({ page }) => {
    await page.goto("/?q=gakusei");
    const s = search(page);
    await expect(s.results.first().locator("summary")).toBeVisible();
    await s.chip("Vocabulary").click();
    await expect(s.status).toHaveText(statusText(expectedCount("gakusei", "vocab")));
    await expect(s.results.first().locator("summary")).toHaveCount(0);
    await s.chip("Kana & Kanji").click();
    await s.chapter.selectOption("kana");
    await expect(s.status).toHaveText(statusText(expectedCount("gakusei", "script", "kana")));
    await expect(s.results.first().getByRole("link")).toHaveAttribute("href", "/kana/1#c1-people-and-family");
    await expect(s.results.first().locator("summary")).toHaveCount(0);
  });

  test("reading reveals stay independent of collapsed source links on phones", async ({ page }) => {
    await page.setViewportSize({width: 375, height: 800});
    await page.goto("/?q=gakkou");
    const s = search(page);
    const englishToggle = page.locator("main:visible").getByRole("checkbox", {name: "Show english", exact: true});
    await englishToggle.uncheck();
    const first = s.results.first();
    const hint = first.locator("[data-reading-hint=english]").first();
    const content = hint.locator(":scope > span[id]");
    await expect(content).toBeHidden();
    await hint.getByRole("button").click();
    await expect(content).toBeVisible();
    await expect(page).toHaveURL("/?q=gakkou");
    await expect(first.locator("details")).not.toHaveAttribute("open", "");
    await first.locator("summary").click();
    await expect(first.getByRole("link", {name: /Kana 1/})).toBeVisible();
    await expect(first.locator("a button, a summary, ruby, rt")).toHaveCount(0);
    const box = await first.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  });


  test("starts idle", async ({ page }) => {
    await page.goto("/");
    const s = search(page);
    await expect(s.box).toBeEnabled();
    await expect(s.box).toHaveValue("");
    await expect(s.status).toHaveText("");
    await expect(page.getByText("Search covers every chapter, kana, kanji and practice page")).toBeVisible();
    await expect(s.results).toHaveCount(0);
    await expect(s.reset).toHaveCount(0);
  });

  test("romaji and Japanese queries, with counts and a clean URL", async ({ page }) => {
    await page.goto("/");
    const s = search(page);

    await s.box.fill("  GAKKOU ");
    await expect(page).toHaveURL("/?q=GAKKOU");
    await expect(s.status).toHaveText(statusText(expectedCount("gakkou")));
    await expect(s.box).toHaveValue("  GAKKOU ");

    await s.box.fill("がっこう");
    await expect(page).toHaveURL("/?q=" + encodeURIComponent("がっこう"));
    await expect(s.status).toHaveText(statusText(expectedCount("がっこう")));
    await expect(s.results.first()).toContainText("がっこう");
  });

  test("category and chapter combine, with 50 per page", async ({ page }) => {
    await page.goto("/");
    const s = search(page);
    await s.chip("Vocabulary").click();
    await s.chapter.selectOption("6");
    await expect(page).toHaveURL("/?category=vocab&chapter=6");
    await expect(s.chip("Vocabulary")).toHaveAttribute("aria-pressed", "true");

    const total = expectedCount("", "vocab", "6");
    expect(total).toBeGreaterThan(50);
    await expect(s.status).toHaveText(statusText(total));
    await expect(s.results).toHaveCount(50);
    await expect(s.showMore).toHaveText(`Show more (${total - 50} left)`);

    await s.showMore.click();
    await expect(s.results).toHaveCount(Math.min(100, total));
    await expect(s.status).toHaveText(statusText(total, 100));
  });

  // Regression: returning to an earlier search used to bring back its old "Show more" count
  test("pagination resets when the search changes, including going back to an earlier one", async ({ page }) => {
    await page.goto("/");
    const s = search(page);
    await s.chip("Vocabulary").click();
    await s.chapter.selectOption("6");
    await expect(s.results).toHaveCount(50);
    await s.showMore.click();
    await expect(s.results).toHaveCount(Math.min(100, expectedCount("", "vocab", "6")));

    await s.chip("Practice").click();
    await expect(s.status).toHaveText(statusText(expectedCount("", "practice", "6")));
    await s.chip("Vocabulary").click();
    await expect(s.status).toHaveText(statusText(expectedCount("", "vocab", "6")));
    await expect(s.results).toHaveCount(50);

    // typing also starts again at 50
    await s.showMore.click();
    await expect(s.results).toHaveCount(Math.min(100, expectedCount("", "vocab", "6")));
    await s.box.fill("a");
    await expect(s.results).toHaveCount(Math.min(50, expectedCount("a", "vocab", "6")));
  });

  // Regression: a second change made before the page re-rendered used to
  // build on the old URL and drop the first one. Both changes are fired in
  // the same task here, which is the fastest a person (or a slow phone) can be.
  test("two quick filter changes both stick", async ({ page }) => {
    await page.goto("/");
    const s = search(page);
    await expect(s.box).toBeEnabled();
    await page.evaluate(() => {
      const section = document.getElementById("search")!;
      const chip = [...section.querySelectorAll("button")].find((b) => b.textContent === "Vocabulary")!;
      const select = section.querySelector("select")!;
      chip.click();
      select.value = "6";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page).toHaveURL("/?category=vocab&chapter=6");
    await expect(s.chip("Vocabulary")).toHaveAttribute("aria-pressed", "true");
    await expect(s.status).toHaveText(statusText(expectedCount("", "vocab", "6")));
  });

  test("Kana, Kanji and N5 practice are chapter options and filter", async ({ page }) => {
    await page.goto("/");
    const s = search(page);
    const labels = await s.chapter.locator("option").allTextContents();
    expect(labels).toEqual(["All chapters", ...Array.from({ length: 10 }, (_, i) => `Chapter ${i + 1}`), "Kana", "Kanji", "N5 practice"]);

    for (const [value, label] of [["kana", "Kana"], ["kanji", "Kanji"], ["practice", "N5 practice"]]) {
      await s.chapter.selectOption({ label });
      await expect(page).toHaveURL(`/?chapter=${value}`);
      await expect(s.status).toHaveText(statusText(expectedCount("", "all", value)));
    }
  });

  test("Clear search text keeps filters and puts the cursor back", async ({ page }) => {
    await page.goto("/?q=desu&category=grammar");
    const s = search(page);
    await expect(s.box).toHaveValue("desu");
    await s.clear.click();
    await expect(page).toHaveURL("/?category=grammar");
    await expect(s.box).toHaveValue("");
    await expect(s.box).toBeFocused();
    await expect(s.chip("Grammar")).toHaveAttribute("aria-pressed", "true");
    await expect(s.clear).toHaveCount(0);
  });

  test("Reset search returns to idle", async ({ page }) => {
    await page.goto("/?q=desu&category=grammar&chapter=1");
    const s = search(page);
    await s.reset.click();
    await expect(page).toHaveURL("/");
    await expect(s.box).toHaveValue("");
    await expect(s.box).toBeFocused();
    await expect(s.status).toHaveText("");
    await expect(s.chapter).toHaveValue("all");
    await expect(s.chip("All")).toHaveAttribute("aria-pressed", "true");
  });

  test("no matches", async ({ page }) => {
    await page.goto("/");
    const s = search(page);
    await s.chip("Vocabulary").click();
    await s.box.fill("zzzqqq");
    await expect(s.status).toHaveText("No results");
    await expect(page.getByText('Nothing matches "zzzqqq" in Vocabulary.')).toBeVisible();
    await expect(s.results).toHaveCount(0);
  });

  test("direct URLs, refresh, Back and Forward", async ({ page }) => {
    await page.goto("/?q=desu&category=grammar&chapter=1");
    const s = search(page);
    const count = statusText(expectedCount("desu", "grammar", "1"));
    await expect(s.box).toHaveValue("desu");
    await expect(s.chapter).toHaveValue("1");
    await expect(s.status).toHaveText(count);

    await page.reload();
    await expect(s.box).toHaveValue("desu");
    await expect(s.status).toHaveText(count);

    await s.chapter.selectOption("2");
    await expect(page).toHaveURL("/?q=desu&category=grammar&chapter=2");
    await page.goBack();
    await expect(page).toHaveURL("/?q=desu&category=grammar&chapter=1");
    await expect(s.chapter).toHaveValue("1");
    await expect(s.status).toHaveText(count);
    await page.goForward();
    await expect(s.chapter).toHaveValue("2");
  });

  test("encoded text, bad values, other params and the hash", async ({ page }) => {
    await page.goto("/?q=%E3%81%8C%E3%81%A3%E3%81%93%E3%81%86");
    const s = search(page);
    await expect(s.box).toHaveValue("がっこう");
    await expect(s.status).toHaveText(statusText(expectedCount("がっこう")));

    await s.box.fill("a&b=c");
    await expect(page).toHaveURL("/?q=a%26b%3Dc");

    await page.goto("/?utm=x&q=desu&category=nope&chapter=99#search");
    await expect(s.chip("All")).toHaveAttribute("aria-pressed", "true");
    await expect(s.chapter).toHaveValue("all");
    await expect(s.status).toHaveText(statusText(expectedCount("desu")));
    await s.chip("Grammar").click();
    await expect(page).toHaveURL("/?utm=x&q=desu&category=grammar#search");
  });

  test("a result opens its study page at the right heading, and Back returns", async ({ page }) => {
    await page.goto("/?q=gakkou");
    const s = search(page);
    await expect(s.status).toHaveText(statusText(expectedCount("gakkou")));
    const link = s.results.first().getByRole("link");
    const href = (await link.getAttribute("href"))!;
    expect(href).toMatch(/^\/(chapters|kana|kanji|practice)\/\d+#.+/);
    await link.click();
    await expect(page).toHaveURL(href);
    const id = decodeURIComponent(href.split("#")[1]);
    await expect.poll(() => offsetFromAnchorTarget(page, id)).toBeLessThanOrEqual(1);

    await page.goBack();
    await expect(page).toHaveURL("/?q=gakkou");
    await expect(s.box).toHaveValue("gakkou");
    await expect(s.status).toHaveText(statusText(expectedCount("gakkou")));
  });

  // The merged content: Kanji 2, both practice exams and the Kim and Ben dialogue
  for (const [q, href, where] of [
    ["いちじかんはん", "/kanji/2#", "Kanji 2"],
    ["ほんや ミナミ", "/practice/1#p1-exam-2-passage-2-a-shop-sign", "Exam 2, Passage 2: A shop sign"],
    ["juuman en gurai", "/chapters/3#c3-3-10-supplemental-reading-kim-and-ben", "Kim and Ben"],
  ]) {
    test(`"${q}" finds ${where} and opens it`, async ({ page }) => {
      await page.goto("/?q=" + encodeURIComponent(q));
      const s = search(page);
      await expect(s.status).toHaveText(statusText(expectedCount(q)));
      const result = s.results.filter({ has: page.locator(`a[href^="${href}"]`) }).first();
      await expect(result).toContainText(where);
      const link = result.getByRole("link");
      const target = (await link.getAttribute("href"))!;
      await link.click();
      await expect(page).toHaveURL(target);
      await expect.poll(() => offsetFromAnchorTarget(page, decodeURIComponent(target.split("#")[1]))).toBeLessThanOrEqual(1);
    });
  }

  test("the index loads only when the search is used", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/search-index.json") requests.push(request.url());
    });
    await page.goto("/");
    const s = search(page);
    await expect(s.box).toBeEnabled();
    await page.waitForLoadState("networkidle");
    expect(requests).toHaveLength(0);
    // the home page HTML doesn't carry the index
    expect(await page.content()).not.toContain('"entries"');

    await s.box.focus();
    await expect.poll(() => requests.length).toBe(1);
    await s.box.fill("gakkou");
    await expect(s.status).toHaveText(statusText(expectedCount("gakkou")));
    await s.box.fill("desu");
    await expect(s.status).toHaveText(statusText(expectedCount("desu")));
    expect(requests).toHaveLength(1);
  });

  test.describe("when the index can't load", () => {
    test.use({ allowedStatuses: [404] });

    test("the search says so and Try again works", async ({ page }) => {
      let fail = true;
      await page.route("**/search-index.json", (route) => (fail ? route.fulfill({ status: 404, body: "" }) : route.fallback()));
      await page.goto("/?q=gakkou");
      const s = search(page);
      await expect(s.status).toHaveText("The search couldn't load.");
      await expect(s.results).toHaveCount(0);
      fail = false;
      await page.locator("#search").getByRole("button", { name: "Try again" }).click();
      await expect(s.status).toHaveText(statusText(expectedCount("gakkou")));
      await expect(s.results.first()).toBeVisible();
    });
  });

  // Synthetic composition events through Chrome DevTools. This checks our
  // handling of composition events; it does not prove a real OS IME works.
  test("IME composition waits for the committed text (synthetic)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "uses Chrome DevTools input events");
    await page.goto("/");
    const s = search(page);
    await s.box.click();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.imeSetComposition", { text: "が", selectionStart: 1, selectionEnd: 1 });
    await cdp.send("Input.imeSetComposition", { text: "がっこ", selectionStart: 3, selectionEnd: 3 });
    await expect(s.box).toHaveValue("がっこ");
    await expect(page).toHaveURL("/");
    await expect(s.status).toHaveText("");

    await cdp.send("Input.insertText", { text: "がっこう" });
    await expect(page).toHaveURL("/?q=" + encodeURIComponent("がっこう"));
    await expect(s.status).toHaveText(statusText(expectedCount("がっこう")));
  });
});
