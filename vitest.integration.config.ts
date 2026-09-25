import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "url";

// DB-backed tests: require DATABASE_URL pointing at a migrated (non-production) database.
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./tests/integration/server-only-stub.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { LOCAL_UPLOAD_DIR: ".data/test-uploads", STORAGE_PROVIDER: "local" },
  },
});
