import { test, expect, visibleMain } from "./fixtures";

// Run against `next dev` as well as production: React reports sibling-key
// collisions in development, and the shared fixture fails on console errors.
for (const chapter of ["1", "2"]) {
  test("Chapter " + chapter + ": both practice panels keep independent answers without console errors", async ({ page }) => {
    await page.goto("/");
    await visibleMain(page).locator('a[href="/chapters/' + chapter + '"]').first().click();
    await expect(page).toHaveURL("/chapters/" + chapter);
    const quick = visibleMain(page).getByRole("region", { name: "Interactive practice", exact: true });
    const sentences = visibleMain(page).getByRole("region", { name: "Sentence building", exact: true });
    await expect(quick).toHaveCount(1);
    await expect(sentences).toHaveCount(1);

    const particles = quick.getByRole("tab", { name: /^Particles/ });
    await particles.click();
    const answer = quick.getByRole("tabpanel").getByRole("textbox").first();
    await answer.fill("は");
    await sentences.locator("[data-tile-bank] button:not([disabled])").first().click();
    await expect(sentences.locator("[data-chosen-tiles] button")).toHaveCount(1);
    await expect(answer).toHaveValue("は");

    await quick.getByRole("tab", { name: /^Vocabulary/ }).click();
    await particles.click();
    await expect(answer).toHaveValue("は");
    await expect(sentences.locator("[data-chosen-tiles] button")).toHaveCount(1);
    await sentences.getByRole("button", { name: "Clear sentence", exact: true }).first().click();
    await expect(sentences.locator("[data-chosen-tiles] button")).toHaveCount(0);
    await expect(answer).toHaveValue("は");
  });
}
