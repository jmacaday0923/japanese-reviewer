import { test, expect, visibleMain } from "./fixtures";

test("cheat sheets: sidebar link, particles from sensei's note and all seven verb groups", async ({ page }) => {
  await page.goto("/");
  await page.locator("aside").first().getByRole("link", { name: "Cheat sheets", exact: true }).click();
  await expect(page).toHaveURL("/cheat-sheets");
  const main = visibleMain(page);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Cheat sheets");
  await expect(main.locator('[data-cheat-sheet="particles"] tbody tr')).toHaveCount(13);
  await expect(main.locator('[data-cheat-sheet="sentence"]')).toContainText("らいげつ");
  await expect(main.locator("[data-verb-group]")).toHaveCount(7);
  const group5 = main.locator('[data-verb-group="group-5"]');
  await expect(group5.locator("tbody tr")).toHaveCount(5);
  await expect(group5.locator("tbody tr").filter({ hasText: "いく" })).toContainText("いった");
  await group5.getByRole("link", { name: "Open the lesson →" }).click();
  await expect(page).toHaveURL(/\/chapters\/10#c10-10-7-/);
});

test("cheat sheets fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/cheat-sheets");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
