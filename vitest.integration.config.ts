import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "url";
import { INTEGRATION_AUTH_ENV } from "./tests/integration/auth-env";

// DB-backed tests: require DATABASE_URL pointing at a migrated (non-production) database.
// A local Neon Auth stand-in is started by the global setup.
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./tests/integration/server-only-stub.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: ["./tests/integration/global-setup.mts"],
    server: { deps: { inline: ["@neondatabase/auth"] } },
    env: { LOCAL_UPLOAD_DIR: ".data/test-uploads", STORAGE_PROVIDER: "local", ...INTEGRATION_AUTH_ENV },
  },
});
