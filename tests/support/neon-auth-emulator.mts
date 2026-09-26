/**
 * Local stand-in for the Neon Auth service, for tests only.
 *
 * Neon Auth is a hosted Better Auth deployment. This runs Better Auth itself, using the exact copy
 * that `@neondatabase/auth` depends on, with Neon Auth's cookie names (`__Secure-neon-auth.*`),
 * email/password sign-in and the admin plugin. The app talks to it through the real
 * `@neondatabase/auth` SDK, exactly as it talks to Neon Auth in production.
 *
 * Differences from hosted Neon Auth: users live in memory (reset on restart) and there is no email
 * delivery, OAuth or console. The provisioning service account is created with the admin role at
 * startup, which in production is a one-off step in the Neon Console.
 */
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

/** Resolve a module the way `@neondatabase/auth` itself does, so we get its exact Better Auth copy. */
function sdkDependency(specifier: string): Promise<Record<string, unknown>> {
  const fromSdk = createRequire(join(process.cwd(), "node_modules/@neondatabase/auth/package.json"));
  return import(pathToFileURL(fromSdk.resolve(specifier)).href);
}

export type EmulatorOptions = {
  port: number;
  /** Origin of the Next.js app, trusted for cross-origin checks */
  appOrigins: string[];
  provisioner: { email: string; password: string };
};

export type RunningEmulator = { baseUrl: string; close: () => Promise<void> };

export async function startNeonAuthEmulator(opts: EmulatorOptions): Promise<RunningEmulator> {
  const { betterAuth } = (await sdkDependency("better-auth")) as { betterAuth: (o: unknown) => BetterAuthInstance };
  const { admin } = (await sdkDependency("better-auth/plugins")) as { admin: () => unknown };
  const { memoryAdapter } = (await sdkDependency("better-auth/adapters/memory")) as { memoryAdapter: (db: unknown) => unknown };
  const { toNodeHandler } = (await sdkDependency("better-auth/node")) as { toNodeHandler: (a: unknown) => Parameters<typeof createServer>[1] };

  const origin = `http://localhost:${opts.port}`;
  const basePath = "/neondb/auth";
  const auth = betterAuth({
    baseURL: origin,
    basePath,
    secret: "neon-auth-emulator-secret-not-for-production",
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    plugins: [admin()],
    advanced: { cookiePrefix: "neon-auth", useSecureCookies: true },
    trustedOrigins: opts.appOrigins,
    logger: { level: "error" },
  });

  // Provisioning service account with the Neon Auth "admin" role.
  const created = await auth.api.signUpEmail({
    body: { email: opts.provisioner.email, password: opts.provisioner.password, name: "Provisioner" },
  });
  const ctx = await auth.$context;
  await ctx.internalAdapter.updateUser(created.user.id, { role: "admin" });

  const server: Server = createServer(toNodeHandler(auth));
  await new Promise<void>((resolve) => server.listen(opts.port, resolve));
  return {
    baseUrl: `${origin}${basePath}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

type BetterAuthInstance = {
  api: { signUpEmail: (a: { body: { email: string; password: string; name: string } }) => Promise<{ user: { id: string } }> };
  $context: Promise<{ internalAdapter: { updateUser: (id: string, data: Record<string, unknown>) => Promise<unknown> } }>;
};

// CLI: `tsx tests/support/neon-auth-emulator.ts` (used by Playwright's webServer)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.NEON_AUTH_EMULATOR_PORT ?? 4100);
  const appOrigins = (process.env.NEON_AUTH_EMULATOR_ORIGINS ?? "http://localhost:3100").split(",");
  const email = process.env.AUTH_PROVISIONER_EMAIL;
  const password = process.env.AUTH_PROVISIONER_PASSWORD;
  if (!email || !password) throw new Error("Set AUTH_PROVISIONER_EMAIL and AUTH_PROVISIONER_PASSWORD");
  startNeonAuthEmulator({ port, appOrigins, provisioner: { email, password } }).then(({ baseUrl }) => {
    console.log(`Neon Auth emulator listening at ${baseUrl}`);
  });
}
