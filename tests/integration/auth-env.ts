/** Test-only Neon Auth settings for the local stand-in (never real credentials). */
export const INTEGRATION_AUTH_ENV = {
  NEON_AUTH_BASE_URL: "http://localhost:4101/neondb/auth",
  NEON_AUTH_COOKIE_SECRET: "integration-test-cookie-secret-0123456789",
  AUTH_PROVISIONER_EMAIL: "provisioner@integration.test",
  AUTH_PROVISIONER_PASSWORD: "integration-provisioner-pw",
  APP_ORIGIN: "http://localhost:3999",
};
