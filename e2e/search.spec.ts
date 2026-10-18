import { test, expect, expectedCount, statusText, search, offsetFromAnchorTarget } from "./fixtures";

test.describe("search", () => {
  test("starts idle", async ({ page }) => {
    await page.goto("/");
    const s = search(page);
    await expect(s.box).toBeEnabled();
    await expect(s.box).toHaveValue("");
    await expect(s.status).toHaveText("");
    await expect(page.getByText("Search covers the document entries")).toBeVisible();
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
    expect(total).toBeGreaterThan(100);
    await expect(s.status).toHaveText(statusText(total));
    await expect(s.results).toHaveCount(50);
    await expect(s.showMore).toHaveText(`Show more (${total - 50} left)`);

    await s.showMore.click();
    await expect(s.results).toHaveCount(100);
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
    await expect(s.results).toHaveCount(100);

    await s.chip("Practice").click();
    await expect(s.status).toHaveText(statusText(expectedCount("", "practice", "6")));
    await s.chip("Vocabulary").click();
    await expect(s.status).toHaveText(statusText(expectedCount("", "vocab", "6")));
    await expect(s.results).toHaveCount(50);

    // typing also starts again at 50
    await s.showMore.click();
    await expect(s.results).toHaveCount(100);
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

  test("General, Kana and Kanji are chapter options and filter", async ({ page }) => {
    await page.goto("/");
    const s = search(page);
    const labels = await s.chapter.locator("option").allTextContents();
    expect(labels.slice(-3)).toEqual(["General", "Kana", "Kanji"]);
    expect(labels[0]).toBe("All chapters");
    expect(labels.slice(1, 11)).toEqual(Array.from({ length: 10 }, (_, i) => `Chapter ${i + 1}`));

    for (const [value, label] of [["gen", "General"], ["kana", "Kana"], ["kanji", "Kanji"]]) {
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

  test("a result opens its lesson at the right heading, and Back returns", async ({ page }) => {
    await page.goto("/?q=gakkou");
    const s = search(page);
    const link = s.results.first().getByRole("link");
    const href = (await link.getAttribute("href"))!;
    expect(href).toMatch(/^\/lessons\/\d+#.+/);
    await link.click();
    await expect(page).toHaveURL(href);
    const id = decodeURIComponent(href.split("#")[1]);
    await expect.poll(() => offsetFromAnchorTarget(page, id)).toBeLessThanOrEqual(1);

    await page.goBack();
    await expect(page).toHaveURL("/?q=gakkou");
    await expect(s.box).toHaveValue("gakkou");
    await expect(s.status).toHaveText(statusText(expectedCount("gakkou")));
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
