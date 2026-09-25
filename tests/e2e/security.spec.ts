import { expect, test, type Browser } from "@playwright/test";
import { ADMIN, createStudentWithChapter, login } from "./helpers";

const suffix = Date.now().toString(36);
const A = { username: `seca_${suffix}`, password: "student-pass-1", name: `Sec A ${suffix}` };
const B = { username: `secb_${suffix}`, password: "student-pass-1", name: `Sec B ${suffix}` };
const viewer = { username: `secv_${suffix}`, password: "staff-pass-123", name: `Sec Viewer ${suffix}` };

// Resources owned by student B, discovered during setup.
const owned = { lessonUrl: "", testUrl: "", attemptUrl: "", vocabId: "", recordingId: "" };

async function newPage(browser: Browser) {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

test.describe.serial("direct URL / API access is enforced server-side", () => {
  test("setup: two students in different chapters, one limited staff member", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, "/admin/login", ADMIN.username, ADMIN.password);
    await createStudentWithChapter(page, A, "Greetings");
    await createStudentWithChapter(page, B, "Family");
    await page.goto("/admin/staff");
    await page.getByText("+ New staff member").click();
    const form = page.locator("details form");
    await form.getByLabel("Name", { exact: true }).fill(viewer.name);
    await form.getByLabel("Username", { exact: true }).fill(viewer.username);
    await form.getByLabel("Password", { exact: true }).fill(viewer.password);
    await form.getByLabel("View students", { exact: true }).check();
    await form.getByRole("button", { name: "Create staff account" }).click();
    await expect(page.getByText(`Staff account ${viewer.username} created.`)).toBeVisible();

    const b = await newPage(browser);
    await login(b, "/login", B.username, B.password);
    await b.getByRole("link", { name: /Start Day 1/ }).click();
    await b.waitForURL(/\/lessons\//);
    owned.lessonUrl = new URL(b.url()).pathname;
    const pronounceHref = await b.getByRole("link", { name: /Practise saying it/ }).getAttribute("href");
    owned.vocabId = new URL(pronounceHref!, "http://x").searchParams.get("word")!;

    const rec = await b.request.post("/api/recordings", {
      multipart: { vocabularyId: owned.vocabId, transcript: "Familie", audio: { name: "r.webm", mimeType: "audio/webm", buffer: Buffer.from([1, 2, 3, 4]) } },
    });
    expect(rec.status()).toBe(200);
    const body = await rec.json();
    owned.recordingId = body.id;
    expect(body.result.overallScore).toBeNull();
    expect((await b.request.get(`/api/recordings/${owned.recordingId}/audio`)).status()).toBe(200);

    await b.goto("/levels");
    await b.getByRole("link", { name: /Family/ }).click();
    await b.getByRole("link", { name: "Open" }).click(); // weekly test
    await b.waitForURL(/\/tests\//);
    owned.testUrl = new URL(b.url()).pathname;
    await b.getByRole("button", { name: /Start test|Resume test/ }).click();
    await expect(b).toHaveURL(/\/attempts\//);
    owned.attemptUrl = new URL(b.url()).pathname;
  });

  test("a student cannot reach another student's lessons, tests, attempts or recordings", async ({ browser }) => {
    const a = await newPage(browser);
    await login(a, "/login", A.username, A.password);
    for (const url of [owned.lessonUrl, `${owned.lessonUrl}/pronounce`, owned.testUrl, owned.attemptUrl]) {
      const res = await a.goto(url);
      expect(res?.status(), url).toBe(404);
    }
    expect((await a.request.get(`/api/recordings/${owned.recordingId}/audio`)).status()).toBe(404);
    const post = await a.request.post("/api/recordings", { multipart: { vocabularyId: owned.vocabId, transcript: "x" } });
    expect(post.status()).toBe(404);
    // A student session cannot open admin pages or admin-only APIs
    await a.goto("/admin/students");
    await expect(a).toHaveURL(/\/admin\/login/);
  });

  test("anonymous requests are rejected", async ({ browser }) => {
    const anon = await newPage(browser);
    expect((await anon.request.get(`/api/recordings/${owned.recordingId}/audio`)).status()).toBe(401);
    expect((await anon.request.post("/api/recordings", { multipart: { vocabularyId: owned.vocabId } })).status()).toBe(401);
    await anon.goto(owned.attemptUrl);
    await expect(anon).toHaveURL(/\/login/);
  });

  test("staff cannot bypass their permissions through direct URLs or APIs", async ({ browser }) => {
    const s = await newPage(browser);
    await login(s, "/admin/login", viewer.username, viewer.password);
    for (const url of ["/admin/settings", "/admin/staff", "/admin/tests", "/admin/results", "/admin/vocabulary/import", "/admin/pronunciation", "/admin/curriculum"]) {
      await s.goto(url);
      await expect(s.getByRole("heading", { name: "Access denied" }), url).toBeVisible();
    }
    // No VIEW_PROGRESS → cannot listen to recordings, and cannot act as a student
    expect((await s.request.get(`/api/recordings/${owned.recordingId}/audio`)).status()).toBe(404);
    expect((await s.request.post("/api/recordings", { multipart: { vocabularyId: owned.vocabId } })).status()).toBe(401);
    const res = await s.goto(owned.lessonUrl);
    await expect(s).toHaveURL(/\/login/);
    expect(res?.ok()).toBe(true);
  });

  test("admins can listen to student recordings; security headers are set", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, "/admin/login", ADMIN.username, ADMIN.password);
    expect((await page.request.get(`/api/recordings/${owned.recordingId}/audio`)).status()).toBe(200);
    const res = await page.goto("/admin");
    expect(res?.headers()["x-frame-options"]).toBe("DENY");
    expect(res?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res?.headers()["x-powered-by"]).toBeUndefined();
    await expect(page.getByText(/“Today” is your local day \(Asia\/Kolkata\)/)).toBeVisible();
  });
});
