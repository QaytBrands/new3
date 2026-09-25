"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin, assertPermission, getCurrentUser, ForbiddenError } from "@/lib/auth/guards";
import { parsePermissions } from "@/lib/permissions";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/time";
import { audit, bool, emailSchema, optionalEmailSchema, passwordSchema, run, str, usernameSchema, UserFacingError, type FormState } from "./common";
import { applyAccountChanges, assertAccountAvailable, createLinkedUser, removeIdentity } from "./accounts";

const nameSchema = z.string().trim().min(1, "Name is required").max(100);
const timezoneSchema = z
  .string()
  .trim()
  .transform((v) => v || DEFAULT_TIMEZONE)
  .refine(isValidTimeZone, "Unknown time zone");

async function findStudent(id: string) {
  const s = await prisma.user.findUnique({ where: { id } });
  if (!s || s.role !== "STUDENT") throw new UserFacingError("Student not found.");
  return s;
}

export async function createStudent(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertPermission("CREATE_STUDENTS");
    const data = {
      username: usernameSchema.parse(str(fd, "username")),
      name: nameSchema.parse(str(fd, "name")),
      email: emailSchema.parse(str(fd, "email")),
      timezone: timezoneSchema.parse(str(fd, "timezone")),
    };
    const password = passwordSchema.parse(str(fd, "password"));
    await assertAccountAvailable(data.username, data.email);
    const s = await createLinkedUser({ email: data.email, password, name: data.name }, (neonAuthUserId) =>
      prisma.user.create({ data: { ...data, role: "STUDENT", neonAuthUserId } }),
    );
    await audit(actor.id, "student.create", s.id, { username: s.username });
    revalidatePath("/admin/students");
    return `Student ${s.username} created.`;
  });
}

export async function updateStudent(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertPermission("EDIT_STUDENTS");
    const s = await findStudent(str(fd, "id"));
    const password = str(fd, "password") ? passwordSchema.parse(str(fd, "password")) : null;
    const name = nameSchema.parse(str(fd, "name"));
    const timezone = timezoneSchema.parse(str(fd, "timezone"));
    const account = await applyAccountChanges(s, { email: optionalEmailSchema.parse(str(fd, "email")), password, active: bool(fd, "active") });
    await prisma.user.update({ where: { id: s.id }, data: { ...account.data, name, timezone } });
    const warning = await account.afterSave();
    await audit(actor.id, "student.update", s.id, { passwordChanged: !!password, linked: !!(account.data.neonAuthUserId ?? s.neonAuthUserId) });
    revalidatePath(`/admin/students/${s.id}`);
    return warning ?? undefined;
  });
}

export async function deleteStudent(_: FormState, fd: FormData): Promise<FormState> {
  const res = await run(async () => {
    const actor = await assertAdmin();
    const s = await findStudent(str(fd, "id"));
    await prisma.user.delete({ where: { id: s.id } });
    await removeIdentity(s.neonAuthUserId);
    await audit(actor.id, "student.delete", s.id, { username: s.username });
  });
  if (res.ok) redirect("/admin/students");
  return res;
}

export async function resetStudentProgress(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertAdmin();
    const s = await findStudent(str(fd, "id"));
    const scope = str(fd, "scope"); // "all" | "tests" | "lessons"
    await prisma.$transaction(async (tx) => {
      if (scope === "all" || scope === "lessons") {
        await tx.lessonProgress.deleteMany({ where: { userId: s.id } });
        await tx.vocabularyProgress.deleteMany({ where: { userId: s.id } });
      }
      if (scope === "all" || scope === "tests") await tx.testAttempt.deleteMany({ where: { userId: s.id } });
      if (scope === "all") await tx.pronunciationAttempt.deleteMany({ where: { userId: s.id } });
    });
    await audit(actor.id, "student.resetProgress", s.id, { scope });
    revalidatePath(`/admin/students/${s.id}`);
    return "Progress reset.";
  });
}

/** Unlock or re-lock content for a student. Level scope needs UNLOCK_LEVELS; chapter/lesson need UNLOCK_CHAPTERS. */
export async function setUnlock(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const scope = z.enum(["LEVEL", "CHAPTER", "LESSON"]).parse(str(fd, "scope"));
    const actor = await assertPermission(scope === "LEVEL" ? "UNLOCK_LEVELS" : "UNLOCK_CHAPTERS");
    const s = await findStudent(str(fd, "userId"));
    const targetId = z.string().min(1).parse(str(fd, "targetId"));
    const lock = str(fd, "mode") === "lock";
    const key = scope === "LEVEL" ? "levelId" : scope === "CHAPTER" ? "chapterId" : "lessonId";

    const exists =
      scope === "LEVEL"
        ? await prisma.level.count({ where: { id: targetId } })
        : scope === "CHAPTER"
          ? await prisma.chapter.count({ where: { id: targetId } })
          : await prisma.lesson.count({ where: { id: targetId } });
    if (!exists) throw new UserFacingError("Content not found.");

    if (lock) {
      await prisma.unlock.deleteMany({ where: { userId: s.id, scope, [key]: targetId } });
    } else {
      const existing = await prisma.unlock.findFirst({ where: { userId: s.id, scope, [key]: targetId } });
      if (!existing) await prisma.unlock.create({ data: { userId: s.id, scope, [key]: targetId, grantedById: actor.id } });
    }
    await audit(actor.id, lock ? "unlock.remove" : "unlock.add", s.id, { scope, targetId });
    revalidatePath(`/admin/students/${s.id}`);
    return lock ? "Locked." : "Unlocked.";
  });
}

export async function createStaff(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertAdmin();
    const data = {
      role: "STAFF" as const,
      username: usernameSchema.parse(str(fd, "username")),
      name: nameSchema.parse(str(fd, "name")),
      email: emailSchema.parse(str(fd, "email")),
      timezone: timezoneSchema.parse(str(fd, "timezone")),
      permissions: parsePermissions(fd.getAll("permissions")),
    };
    const password = passwordSchema.parse(str(fd, "password"));
    await assertAccountAvailable(data.username, data.email);
    const u = await createLinkedUser({ email: data.email, password, name: data.name }, (neonAuthUserId) =>
      prisma.user.create({ data: { ...data, neonAuthUserId } }),
    );
    await audit(actor.id, "staff.create", u.id, { permissions: u.permissions });
    revalidatePath("/admin/staff");
    return `Staff account ${u.username} created.`;
  });
}

export async function updateStaff(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertAdmin();
    const id = str(fd, "id");
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u || u.role !== "STAFF") throw new UserFacingError("Staff member not found.");
    const password = str(fd, "password") ? passwordSchema.parse(str(fd, "password")) : null;
    const permissions = parsePermissions(fd.getAll("permissions"));
    const name = nameSchema.parse(str(fd, "name"));
    const timezone = timezoneSchema.parse(str(fd, "timezone"));
    const account = await applyAccountChanges(u, { email: optionalEmailSchema.parse(str(fd, "email")), password, active: bool(fd, "active") });
    await prisma.user.update({ where: { id }, data: { ...account.data, name, timezone, permissions } });
    const warning = await account.afterSave();
    await audit(actor.id, "staff.update", id, { permissions, passwordChanged: !!password });
    revalidatePath("/admin/staff");
    return warning ?? undefined;
  });
}

/** Any signed-in admin/staff member may change their own time zone (and nothing else here). */
export async function updateOwnTimezone(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const me = await getCurrentUser();
    if (!me || (me.role !== "ADMIN" && me.role !== "STAFF")) throw new ForbiddenError();
    await prisma.user.update({ where: { id: me.id }, data: { timezone: timezoneSchema.parse(str(fd, "timezone")) } });
    revalidatePath("/admin");
    return "Time zone updated.";
  });
}
