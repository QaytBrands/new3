import { expect, test } from "@playwright/test";
import { ADMIN, login, logout } from "./helpers";

const suffix = Date.now().toString(36);
const student = { username: `e2e_${suffix}`, password: "student-pass-1", name: `E2E Student ${suffix}` };
const staff = { username: `staff_${suffix}`, password: "staff-pass-12", name: `E2E Staff ${suffix}` };

test.describe.serial("admin → student learning flow", () => {
  test("admin creates a student and unlocks the first chapter", async ({ page }) => {
    await login(page, "/admin/login", ADMIN.username, ADMIN.password);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.goto("/admin/students");
    await page.getByText("+ New student").click();
    await page.getByLabel("Name", { exact: true }).fill(student.name);
    await page.getByLabel("Username", { exact: true }).fill(student.username);
    await page.locator("details form input[name=email]").fill(`${student.username}@wortweg.test`);
    await page.getByLabel("Initial password", { exact: true }).fill(student.password);
    await page.getByRole("button", { name: "Create student" }).click();
    await expect(page.getByText(`Student ${student.username} created.`)).toBeVisible();

    await page.reload();
    await page.getByRole("link", { name: student.name }).click();
    // Attach a native recording to the second Day 1 word
    await page.goto("/admin/curriculum");
    await page.getByRole("link", { name: /Greetings/ }).first().click();
    await page.getByRole("link", { name: "Hello & goodbye" }).click();
    await page.getByRole("link", { name: /Tschüss/ }).click();
    await expect(page).toHaveURL(/\/admin\/vocabulary\//);
    await expect(page.getByRole("heading", { level: 1, name: /Tschüss/ })).toBeVisible();
    await page.locator("input[name=nativeAudioUrl]").first().fill("https://example.com/audio/tschuess.mp3");
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.goto("/admin/students");
    await page.getByRole("link", { name: student.name }).click();
    const greetings = page.locator("li", { hasText: "Greetings" }).first();
    await greetings.getByRole("button", { name: "Unlock" }).first().click();
    await expect(greetings.getByRole("button", { name: "Lock" }).first()).toBeVisible();
  });

  test("student cannot see locked content and cannot open admin", async ({ page }) => {
    await login(page, "/login", student.username, student.password);
    await page.goto("/levels");
    await expect(page.getByText("Greetings")).toBeVisible();
    await expect(page.getByRole("link", { name: /Family/ })).toHaveCount(0); // locked chapter is not a link

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("student completes Day 1 and takes the daily test", async ({ page }) => {
    await login(page, "/login", student.username, student.password);
    await expect(page.getByRole("link", { name: /Start Day 1/ })).toBeVisible();
    await expect(page.getByTestId("today-summary")).toContainText("Today: 0 lessons completed");
    await page.getByRole("link", { name: /Start Day 1/ }).click();

    await expect(page.getByRole("heading", { name: "Hallo" })).toBeVisible();
    await expect(page.getByText("Synthesized voice").first()).toBeVisible();
    await page.getByRole("button", { name: "Mark difficult" }).click();
    await page.getByRole("button", { name: "Next →" }).click();
    await expect(page.getByRole("heading", { name: "Tschüss" })).toBeVisible();
    await expect(page.getByText("Native recording").first()).toBeVisible();
    while (await page.getByRole("button", { name: "Next →" }).isVisible()) {
      await page.getByRole("button", { name: "Next →" }).click();
    }
    await page.getByRole("button", { name: "Finish lesson" }).click();
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    await page.getByRole("link", { name: "Take the daily test" }).click();
    await page.getByRole("button", { name: "Start test" }).click();
    await expect(page).toHaveURL(/\/attempts\//);

    // Answer every question: pick the first option or type a guess.
    for (;;) {
      const input = page.getByLabel("Your answer", { exact: true });
      if (await input.isVisible()) await input.fill("Hallo");
      else {
        const options = page.locator("section button[aria-pressed]");
        if (await options.count()) await options.first().click();
      }
      const next = page.getByRole("button", { name: "Next →" });
      if (await next.isVisible()) await next.click();
      else break;
    }
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText(/\d+(\.\d)?%/).first()).toBeVisible();
    await expect(page.getByText(/correct/).first()).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText(/Revision words/)).toBeVisible();
    await expect(page.getByTestId("today-summary")).toContainText("Today: 1 lesson completed · 1 test taken");
    await page.goto("/words?filter=difficult");
    await expect(page.getByText("Hallo").first()).toBeVisible();
  });

  test("admin sees the attempt in results", async ({ page }) => {
    await login(page, "/admin/login", ADMIN.username, ADMIN.password);
    await page.goto("/admin/results");
    await expect(page.getByRole("link", { name: student.name }).first()).toBeVisible();
  });

  test("staff only get explicitly granted permissions", async ({ page }) => {
    await login(page, "/admin/login", ADMIN.username, ADMIN.password);
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
    await logout(page);

    await login(page, "/admin/login", staff.username, staff.password);
    await expect(page.getByRole("link", { name: "Students", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Curriculum", exact: true })).toHaveCount(0);
    await page.goto("/admin/curriculum");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    await page.goto("/admin/students");
    await expect(page.getByText("+ New student")).toHaveCount(0);
    await page.getByRole("link", { name: student.name }).click();
    await expect(page.getByRole("button", { name: /^(Unlock|Lock)$/ })).toHaveCount(0);
  });

  test("students cannot sign in on the staff login", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Username", { exact: true }).fill(student.username);
    await page.getByLabel("Password", { exact: true }).fill(student.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect username or password.")).toBeVisible();
  });
});
