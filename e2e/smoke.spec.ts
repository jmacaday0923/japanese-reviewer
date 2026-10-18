import { test, expect, visibleMain, search, offsetFromAnchorTarget, type Page } from "./fixtures";

// A short check that a deployed site works: run it against production with
// E2E_BASE_URL (see the README). It also runs with the full local suite.
//
// It doesn't compare counts with the local data files, so it still passes
// when the deployed data is older or newer than your checkout. Every test
// also fails on page errors, console errors and failed requests (the
// browserProblems fixture in fixtures.ts).

test.use({ viewport: { width: 1440, height: 900 } });

const readers = [
  { path: "/chapters/1", section: "Chapters" },
  { path: "/kana/1", section: "Kana" },
  { path: "/kanji/1", section: "Kanji" },
  { path: "/lessons/1", section: "Documents" },
];

async function expectReader(page: Page, section: string) {
  const main = visibleMain(page);
  await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(main.getByRole("heading", { level: 1 })).not.toBeEmpty();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  await expect(breadcrumb.getByRole("link", { name: section, exact: true })).toBeVisible();
  await expect(main.locator(".lesson").first()).not.toBeEmpty();
}

test("home page loads with its sections", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Japanese Lesson Reviewer", level: 1 })).toBeVisible();
  for (const name of ["Search", "Chapters", "Kana", "Kanji"]) {
    await expect(page.getByRole("heading", { name, level: 2, exact: true })).toBeVisible();
  }
});

test("search finds results and a result opens at its heading", async ({ page }) => {
  await page.goto("/");
  const s = search(page);
  await expect(s.box).toBeEnabled();
  await s.box.fill("gakkou");
  await expect(page).toHaveURL("/?q=gakkou");
  await expect(s.status).toHaveText(/^[\d,]+ results?\b/);
  await expect(s.results.first()).toBeVisible();

  const link = s.results.first().getByRole("link");
  const href = (await link.getAttribute("href"))!;
  expect(href).toMatch(/^\/lessons\/\d+#.+/);
  await link.click();
  await expect(page).toHaveURL(href);
  await expect.poll(() => offsetFromAnchorTarget(page, decodeURIComponent(href.split("#")[1]))).toBeLessThanOrEqual(1);

  await page.goBack();
  await expect(s.box).toHaveValue("gakkou");
});

for (const { path, section } of readers) {
  test(`${path} reader loads`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expectReader(page, section);
  });
}

test("a section anchor from the outline works when opened directly", async ({ page, request }) => {
  await page.goto("/chapters/1");
  const first = page.locator("aside").getByRole("navigation", { name: "On this page" }).getByRole("link").first();
  const hash = (await first.getAttribute("href"))!;
  expect(hash).toMatch(/^#.+/);
  const id = decodeURIComponent(hash.slice(1));

  // The heading is in the first HTML, not streamed in later
  const html = await (await request.get("/chapters/1")).text();
  expect(html).toContain(`id="${id}"`);

  await page.goto("/chapters/1" + hash);
  await expect.poll(() => offsetFromAnchorTarget(page, id)).toBeLessThanOrEqual(1);
});
