import { test, expect, visibleMain } from "./fixtures";

test("cheat sheets: sidebar link, Particles tab first, and the Verb groups tab with all seven groups", async ({ page }) => {
  await page.goto("/");
  await page.locator("aside").first().getByRole("link", { name: "Cheat sheets", exact: true }).click();
  await expect(page).toHaveURL("/cheat-sheets");
  const main = visibleMain(page);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Cheat sheets");
  const tabs = main.getByRole("tablist", { name: "Cheat sheets" }).getByRole("tab");
  await expect(tabs).toHaveText(["Particles", "Verb groups"]);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(main.locator('[data-cheat-sheet="particles"] tbody tr')).toHaveCount(13);
  await expect(main.locator('[data-cheat-sheet="sentence"]')).toContainText("らいげつ");
  await expect(main.locator("[data-verb-group]").first()).toBeHidden();

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(main.locator('[data-cheat-sheet="particles"]')).toBeHidden();
  await expect(main.locator("[data-verb-group]")).toHaveCount(7);
  const group5 = main.locator('[data-verb-group="group-5"]');
  await expect(group5).toBeVisible();
  await expect(group5.locator("tbody tr")).toHaveCount(5);
  await expect(group5.locator("tbody tr").filter({ hasText: "いく" })).toContainText("いった");
  await group5.getByRole("link", { name: "Open the lesson →" }).click();
  await expect(page).toHaveURL(/\/chapters\/10#c10-10-7-/);
});

test("cheat sheet tabs work with the keyboard", async ({ page }) => {
  await page.goto("/cheat-sheets");
  const tabs = visibleMain(page).getByRole("tab");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(visibleMain(page).getByRole("tabpanel")).toHaveAccessibleName("Verb groups");
  await page.keyboard.press("Home");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
});

test("cheat sheets fit a phone screen on both tabs", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/cheat-sheets");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await visibleMain(page).getByRole("tab", { name: "Verb groups" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
