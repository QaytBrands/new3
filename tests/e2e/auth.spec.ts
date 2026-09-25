import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, createStudentWithChapter, login } from "./helpers";

const SESSION_COOKIE = "__Secure-neon-auth.session_token";
const suffix = Date.now().toString(36);
const student = { username: `auth_s_${suffix}`, password: "student-pass-1", name: `Auth Student ${suffix}` };
const staff = { username: `auth_t_${suffix}`, password: "staff-pass-123", name: `Auth Staff ${suffix}` };

async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE);
}

async function attemptLogin(page: Page, path: "/login" | "/admin/login", username: string, password: string) {
  await page.goto(path);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe.serial("Neon Auth sign-in, portals and sessions", () => {
  test("setup: admin creates a student and a staff member", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, "/admin/login", ADMIN.username, ADMIN.password);
    await createStudentWithChapter(page, student, "Greetings");
    await page.goto("/admin/staff");
    await page.getByText("+ New staff member").click();
    const form = page.locator("details form");
    await form.getByLabel("Name", { exact: true }).fill(staff.name);
    await form.getByLabel("Username", { exact: true }).fill(staff.username);
    await form.locator("input[name=email]").fill(`${staff.username}@wortweg.test`);
    await form.getByLabel("Password", { exact: true }).fill(staff.password);
    await form.getByLabel("View students", { exact: true }).check();
    await form.getByRole("button", { name: "Create staff account" }).click();
    await expect(page.getByText(`Staff account ${staff.username} created.`)).toBeVisible();
  });

  test("1. student login → student dashboard with a secure, HttpOnly Neon Auth session cookie", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, "/login", student.username, student.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    const cookie = await sessionCookie(page);
    expect(cookie).toBeDefined();
    expect(cookie).toMatchObject({ httpOnly: true, secure: true });
  });

  test("2. staff login → admin area limited to granted permissions", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, "/admin/login", staff.username, staff.password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Students", exact: true })).toBeVisible();
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });

  test("3. admin login → admin dashboard with admin-only areas", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, "/admin/login", ADMIN.username, ADMIN.password);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("4. a student on the admin/staff login is refused and gets no session", async ({ browser }) => {
    const page = await newPage(browser);
    await attemptLogin(page, "/admin/login", student.username, student.password);
    await expect(page.getByText("Incorrect username or password.")).toBeVisible();
    expect(await sessionCookie(page)).toBeUndefined();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("5. staff on the student login is refused and gets no session", async ({ browser }) => {
    const page = await newPage(browser);
    await attemptLogin(page, "/login", staff.username, staff.password);
    await expect(page.getByText("Incorrect username or password.")).toBeVisible();
    expect(await sessionCookie(page)).toBeUndefined();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a staff member signed in through the staff login still gets no student access", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, "/admin/login", staff.username, staff.password);
    for (const url of ["/dashboard", "/levels", "/words"]) {
      await page.goto(url);
      await expect(page, url).toHaveURL(/\/login$/);
    }
  });

  test("10. logout ends the session; protected pages and APIs are closed afterwards", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, "/login", student.username, student.password);
    const before = await sessionCookie(page);
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await sessionCookie(page)).toBeUndefined();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    // Replaying the old session token doesn't work: it was revoked by Neon Auth on sign-out.
    await page.context().addCookies([{ ...before!, sameSite: "Lax" }]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("11. an invalid or forged session is treated as signed out", async ({ browser }) => {
    const page = await newPage(browser);
    await page.context().addCookies([
      { name: SESSION_COOKIE, value: "forged-token", domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" },
      { name: "__Secure-neon-auth.local.session_data", value: "eyJhbGciOiJIUzI1NiJ9.e30.forged", domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/admin/students");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("12. protected APIs reject missing and forged sessions", async ({ browser }) => {
    const page = await newPage(browser);
    expect((await page.request.post("/api/recordings", { multipart: { vocabularyId: "x" } })).status()).toBe(401);
    await page.context().addCookies([{ name: SESSION_COOKIE, value: "forged-token", domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
    expect((await page.request.post("/api/recordings", { multipart: { vocabularyId: "x" } })).status()).toBe(401);
    expect((await page.request.get("/api/recordings/anything/audio")).status()).toBe(401);
    // The Auth.js endpoints are gone, and no Neon Auth proxy (with its admin endpoints) is exposed.
    expect((await page.request.post("/api/auth/sign-in/email", { data: {} })).status()).toBe(404);
    expect((await page.request.post("/api/auth/admin/create-user", { data: {} })).status()).toBe(404);
  });

  test("admin password reset: the new password works and the old one doesn't", async ({ browser }) => {
    const admin = await newPage(browser);
    await login(admin, "/admin/login", ADMIN.username, ADMIN.password);
    await admin.goto("/admin/students");
    await admin.getByRole("link", { name: student.name }).click();
    await admin.getByLabel(/New password/).fill("reset-password-9");
    await admin.getByRole("button", { name: "Save" }).first().click();
    await expect(admin.getByText("Saved.")).toBeVisible();

    const old = await newPage(browser);
    await attemptLogin(old, "/login", student.username, student.password);
    await expect(old.getByText("Incorrect username or password.")).toBeVisible();
    const fresh = await newPage(browser);
    await login(fresh, "/login", student.username, "reset-password-9");
    await expect(fresh).toHaveURL(/\/dashboard$/);
    student.password = "reset-password-9";
  });

  test("staff change their own password on My account (current password verified by Neon Auth)", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, "/admin/login", staff.username, staff.password);
    await page.goto("/admin/account");
    const form = page.locator("form", { has: page.getByRole("button", { name: "Change password" }) });
    await form.getByLabel("Current password").fill("not-my-password");
    await form.getByLabel(/^New password/).fill("staff-new-pass-7");
    await form.getByLabel("Confirm new password").fill("staff-new-pass-7");
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Current password is incorrect.")).toBeVisible();

    await form.getByLabel("Current password").fill(staff.password);
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed.")).toBeVisible();

    const old = await newPage(browser);
    await attemptLogin(old, "/admin/login", staff.username, staff.password);
    await expect(old.getByText("Incorrect username or password.")).toBeVisible();
    const fresh = await newPage(browser);
    await login(fresh, "/admin/login", staff.username, "staff-new-pass-7");
    await expect(fresh).toHaveURL(/\/admin$/);
    staff.password = "staff-new-pass-7";
  });

  test("6. deactivation cuts off a signed-in student immediately and blocks new sign-ins", async ({ browser }) => {
    const s = await newPage(browser);
    await login(s, "/login", student.username, student.password);
    await expect(s).toHaveURL(/\/dashboard$/);

    const admin = await newPage(browser);
    await login(admin, "/admin/login", ADMIN.username, ADMIN.password);
    await admin.goto("/admin/students");
    await admin.getByRole("link", { name: student.name }).click();
    await admin.getByLabel("Account active").uncheck();
    await admin.getByRole("button", { name: "Save" }).first().click();
    await expect(admin.getByText("Saved.")).toBeVisible();

    await s.goto("/levels");
    await expect(s).toHaveURL(/\/login/);
    const again = await newPage(browser);
    await attemptLogin(again, "/login", student.username, student.password);
    await expect(again.getByText("Incorrect username or password.")).toBeVisible();

    // Re-activation restores access.
    await admin.getByLabel("Account active").check();
    await admin.getByRole("button", { name: "Save" }).first().click();
    await expect(admin.getByText("Saved.")).toBeVisible();
    await login(again, "/login", student.username, student.password);
    await expect(again).toHaveURL(/\/dashboard$/);
  });
});
