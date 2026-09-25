import type { PrismaClient, Role, User } from "@prisma/client";
import type { IdentityAdmin } from "../src/lib/auth/provisioning";
import type { Env } from "../src/lib/auth/neon-config";

export type SeedUserSpec = { username: string; name: string; role: Role; email: string; password: string };

/**
 * Makes sure an application user exists and is linked to a working Neon Auth identity. Idempotent.
 *
 * - Already linked to an existing identity → nothing changes (the password is NOT reset).
 * - Linked identity missing (deleted, or a fresh test auth server) → re-provisioned and re-linked.
 * - An identity with this email already exists but isn't linked → it is adopted only after its
 *   password is reset to the seed password and its sessions are revoked, so an identity someone
 *   pre-registered with that email can't be used to take over the account.
 */
export async function ensureLinkedUser(prisma: PrismaClient, ids: IdentityAdmin, spec: SeedUserSpec): Promise<User> {
  const email = spec.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username: spec.username } });
  if (existing && existing.role !== spec.role) {
    throw new Error(`User "${spec.username}" exists with role ${existing.role}, expected ${spec.role}.`);
  }
  if (existing?.email && existing.email !== email) {
    throw new Error(`User "${spec.username}" already has sign-in email ${existing.email}; refusing to change it to ${email}.`);
  }
  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== existing?.id) {
    throw new Error(`Email ${email} already belongs to user "${emailOwner.username}".`);
  }

  if (existing?.neonAuthUserId && (await ids.findIdentityById(existing.neonAuthUserId))) {
    return existing;
  }

  let identityId: string;
  const byEmail = await ids.findIdentityByEmail(email);
  if (byEmail) {
    await ids.setPassword(byEmail.id, spec.password); // also revokes its sessions
    if (byEmail.banned) await ids.enable(byEmail.id);
    identityId = byEmail.id;
    console.log(`Adopted existing Neon Auth identity for ${email} and reset its password.`);
  } else {
    identityId = (await ids.createIdentity({ email, password: spec.password, name: spec.name })).id;
    console.log(`Created Neon Auth identity for ${email}.`);
  }

  return prisma.user.upsert({
    where: { username: spec.username },
    create: { username: spec.username, name: spec.name, role: spec.role, email, neonAuthUserId: identityId },
    update: { email, neonAuthUserId: identityId },
  });
}

export function isProductionEnvironment(env: Env = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}
