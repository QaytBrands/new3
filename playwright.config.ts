import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /student-mobile/ },
  ],
  webServer: [
    {
      // Local stand-in for Neon Auth (Better Auth + the real @neondatabase/auth SDK on the app side).
      // Ready once the seeded admin/demo accounts are linked to identities on it.
      command: "npx tsx tests/support/e2e-auth-server.mts",
      url: "http://localhost:4109",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
