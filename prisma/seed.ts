import { PrismaClient } from "@prisma/client";
import { seedSampleCurriculum } from "./sample-curriculum";
import { createIdentityAdmin } from "../src/lib/auth/provisioning";
import { ensureLinkedUser, isProductionEnvironment } from "./seed-identities";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const username = (process.env.SEED_ADMIN_USERNAME ?? "admin").toLowerCase();
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const demoPassword = process.env.SEED_DEMO_STUDENT_PASSWORD;
  if (!email) throw new Error("Set SEED_ADMIN_EMAIL (the admin's Neon Auth sign-in email).");
  if (!password || password.length < 8) throw new Error("Set SEED_ADMIN_PASSWORD (min 8 chars) to seed the admin account.");
  if (demoPassword && isProductionEnvironment()) {
    throw new Error("SEED_DEMO_STUDENT_PASSWORD is set in a production environment. The demo account is for development only; unset it.");
  }
  const identities = createIdentityAdmin();
  await ensureLinkedUser(prisma, identities, { username, name: "Administrator", role: "ADMIN", email, password });

  if (!(await seedSampleCurriculum(prisma))) console.log("A1 already exists; skipping curriculum seed.");

  if (demoPassword) {
    const a1 = await prisma.level.findUniqueOrThrow({ where: { code: "A1" }, include: { chapters: { orderBy: { order: "asc" }, take: 1 } } });
    const student = await ensureLinkedUser(prisma, identities, {
      username: "demo",
      name: "Demo Student",
      role: "STUDENT",
      email: process.env.SEED_DEMO_STUDENT_EMAIL ?? "demo.student@example.com",
      password: demoPassword,
    });
    if (a1.chapters[0]) {
      await prisma.unlock.upsert({
        where: { userId_chapterId: { userId: student.id, chapterId: a1.chapters[0].id } },
        create: { userId: student.id, scope: "CHAPTER", chapterId: a1.chapters[0].id },
        update: {},
      });
    }
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
