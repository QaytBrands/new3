/**
 * Playwright webServer: starts the local Neon Auth stand-in, then (re)links the seeded admin and
 * demo accounts to identities on it (its users live in memory, so each run starts empty).
 */
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { startNeonAuthEmulator } from "./neon-auth-emulator.mts";
import { createIdentityAdmin } from "../../src/lib/auth/provisioning";
import { ensureLinkedUser } from "../../prisma/seed-identities";

const env = process.env;
const url = new URL(env.NEON_AUTH_BASE_URL ?? "http://localhost:4100/neondb/auth");
const emulator = await startNeonAuthEmulator({
  port: Number(url.port),
  appOrigins: [env.APP_ORIGIN ?? "http://localhost:3100"],
  provisioner: { email: env.AUTH_PROVISIONER_EMAIL!, password: env.AUTH_PROVISIONER_PASSWORD! },
});

const prisma = new PrismaClient();
const ids = createIdentityAdmin();
await ensureLinkedUser(prisma, ids, {
  username: (env.SEED_ADMIN_USERNAME ?? "admin").toLowerCase(),
  name: "Administrator",
  role: "ADMIN",
  email: env.SEED_ADMIN_EMAIL!,
  password: env.SEED_ADMIN_PASSWORD!,
});
if (env.SEED_DEMO_STUDENT_PASSWORD) {
  await ensureLinkedUser(prisma, ids, {
    username: "demo",
    name: "Demo Student",
    role: "STUDENT",
    email: env.SEED_DEMO_STUDENT_EMAIL ?? "demo.student@example.com",
    password: env.SEED_DEMO_STUDENT_PASSWORD,
  });
}
await prisma.$disconnect();

// Readiness signal for Playwright: only answers once the accounts above are linked.
createServer((_req, res) => res.end("ready")).listen(Number(env.NEON_AUTH_EMULATOR_READY_PORT ?? 4109));
console.log(`Neon Auth stand-in ready at ${emulator.baseUrl}`);
