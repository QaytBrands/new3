import { expect, type Page } from "@playwright/test";

export const ADMIN = { username: process.env.SEED_ADMIN_USERNAME ?? "admin", password: process.env.SEED_ADMIN_PASSWORD ?? "change-me-please" };

export async function login(page: Page, path: "/login" | "/admin/login", username: string, password: string) {
  await page.goto(path);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/login/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/login/);
}
