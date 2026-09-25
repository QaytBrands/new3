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

/** Creates a student through the admin UI and unlocks one chapter. Caller must be signed in as admin. */
export async function createStudentWithChapter(page: Page, s: { name: string; username: string; password: string }, chapter: string) {
  await page.goto("/admin/students");
  await page.getByText("+ New student").click();
  await page.getByLabel("Name", { exact: true }).fill(s.name);
  await page.getByLabel("Username", { exact: true }).fill(s.username);
  await page.getByLabel("Initial password", { exact: true }).fill(s.password);
  await page.getByRole("button", { name: "Create student" }).click();
  await expect(page.getByText(`Student ${s.username} created.`)).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: s.name }).click();
  const row = page.locator("li", { hasText: chapter }).first();
  await row.getByRole("button", { name: "Unlock" }).first().click();
  await expect(row.getByRole("button", { name: "Lock" }).first()).toBeVisible();
}
