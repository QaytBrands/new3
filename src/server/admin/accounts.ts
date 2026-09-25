import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createIdentityAdmin, type IdentityAdmin } from "@/lib/auth/provisioning";
import { UserFacingError } from "./common";

/**
 * Keeps application users and their Neon Auth sign-in identities in step. Callers must already have
 * passed the application's permission checks — this module does no authorization of its own.
 */
let admin: IdentityAdmin | null = null;
function identities(): IdentityAdmin {
  return (admin ??= createIdentityAdmin());
}

export async function assertAccountAvailable(username: string, email: string) {
  const clash = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] }, select: { username: true, email: true } });
  if (clash?.username === username) throw new UserFacingError("That username is already in use.");
  if (clash) throw new UserFacingError("That email is already used by another account.");
}

/**
 * Creates the Neon Auth identity first, then the application user linked to it. If the database
 * write fails the identity is removed again, so no orphaned sign-in account is left behind.
 */
export async function createLinkedUser(
  input: { email: string; password: string; name: string },
  create: (neonAuthUserId: string) => Promise<User>,
): Promise<User> {
  const identity = await identities().createIdentity(input);
  try {
    return await create(identity.id);
  } catch (e) {
    await identities()
      .remove(identity.id)
      .catch((err) => console.error("Could not roll back Neon Auth identity", identity.id, err));
    throw e;
  }
}

export type AccountChanges = { email: string | null; password: string | null; active: boolean };

/**
 * Applies sign-in related changes for an existing user and returns the fields to persist.
 * - Unlinked users (created before Neon Auth) get a new identity when a password is set: this is
 *   how existing accounts are migrated / re-invited.
 * - The sign-in email of a linked user can't be changed here (it would silently re-point the login).
 * - Re-activation enables the identity before saving; deactivation is saved first (the application
 *   flag is authoritative and blocks access immediately) and then the identity is disabled.
 */
export async function applyAccountChanges(user: User, changes: AccountChanges): Promise<{ data: Partial<User>; afterSave: () => Promise<string | null> }> {
  const data: Partial<User> = { active: changes.active };

  if (!user.neonAuthUserId) {
    if (changes.email && changes.email !== user.email) {
      const clash = await prisma.user.findFirst({ where: { email: changes.email, NOT: { id: user.id } }, select: { id: true } });
      if (clash) throw new UserFacingError("That email is already used by another account.");
      data.email = changes.email;
    }
    if (changes.password) {
      const email = changes.email ?? user.email;
      if (!email) throw new UserFacingError("An email is required to create this user's sign-in account.");
      const identity = await identities().createIdentity({ email, password: changes.password, name: user.name });
      data.neonAuthUserId = identity.id;
      data.email = email;
    }
  } else {
    if (changes.email && changes.email !== user.email) {
      throw new UserFacingError("The sign-in email of an existing account can't be changed here.");
    }
    if (changes.password) await identities().setPassword(user.neonAuthUserId, changes.password);
    if (changes.active && !user.active) await identities().enable(user.neonAuthUserId);
  }

  const identityId = data.neonAuthUserId ?? user.neonAuthUserId;
  const deactivating = !changes.active && user.active && identityId;
  return {
    data,
    afterSave: async () => {
      if (!deactivating) return null;
      try {
        await identities().disable(identityId!);
        return null;
      } catch (e) {
        console.error("Could not disable Neon Auth identity", identityId, e);
        return "Account deactivated. (Neon Auth could not be updated; access is still blocked by the app.)";
      }
    },
  };
}

/** Removes the identity after the application user has been deleted. Best effort. */
export async function removeIdentity(neonAuthUserId: string | null) {
  if (!neonAuthUserId) return;
  await identities()
    .remove(neonAuthUserId)
    .catch((err) => console.error("Could not remove Neon Auth identity", neonAuthUserId, err));
}
