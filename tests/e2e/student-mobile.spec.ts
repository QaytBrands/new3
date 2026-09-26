import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Uses the seeded demo student (SEED_DEMO_STUDENT_PASSWORD) to screenshot key screens at phone width.
const password = process.env.SEED_DEMO_STUDENT_PASSWORD;

test("student screens render at phone width", async ({ page }) => {
  test.skip(!password, "SEED_DEMO_STUDENT_PASSWORD not set");
  await login(page, "/login", "demo", password!);
  await expect(page.getByRole("heading", { name: /Hallo, Demo/ })).toBeVisible();
  await page.screenshot({ path: "test-results/screens/dashboard.png", fullPage: true });

  await page.goto("/levels");
  await page.getByRole("link", { name: /Greetings/ }).click();
  await page.getByRole("link", { name: /Day 2/ }).click();
  await expect(page.getByRole("button", { name: /Play pronunciation/ })).toBeVisible();
  const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noHorizontalScroll).toBe(true);
  await page.screenshot({ path: "test-results/screens/lesson.png", fullPage: true });

  await page.getByRole("link", { name: "Pronounce" }).click();
  await expect(page.getByText("Say it like")).toBeVisible();
  await page.screenshot({ path: "test-results/screens/pronounce.png", fullPage: true });
});
