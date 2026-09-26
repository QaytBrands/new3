/**
 * Server-side management of Neon Auth identities (create, set password, ban/unban, remove).
 *
 * Calls go through the Neon Auth admin API as a dedicated service account that holds Neon Auth's
 * "admin" role. Its session lives in an in-memory cookie jar for the duration of one operation —
 * it never touches a browser's cookies. People are never given the Neon Auth admin role; who may
 * trigger these operations is decided by the application's own permissions before calling here.
 *
 * Framework-agnostic (no Next.js / server-only imports) so the seed script can use it.
 */
import { createAuthServer } from "@neondatabase/auth/server";
import {
  type Env,
  getAppOrigin,
  getNeonAuthSettings,
  getProvisionerCredentials,
  SESSION_DATA_TTL_SECONDS,
} from "./neon-config";

export class ProvisioningError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProvisioningError";
  }
}

export type Identity = { id: string; email: string; banned: boolean };

export interface IdentityAdmin {
  createIdentity(input: { email: string; password: string; name: string }): Promise<Identity>;
  findIdentityByEmail(email: string): Promise<Identity | null>;
  findIdentityById(id: string): Promise<Identity | null>;
  setPassword(id: string, password: string): Promise<void>;
  /** Blocks sign-in and ends the identity's sessions. */
  disable(id: string): Promise<void>;
  enable(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

type ApiResult<T> = { data: T | null; error: { message: string; status: number } | null };
type Server = ReturnType<typeof createAuthServer>;
type RawUser = { id: string; email: string; banned?: boolean | null };

const silent = { debug() {}, info() {}, warn() {}, error() {} };

function unwrap<T>(res: ApiResult<T>, what: string): T {
  if (res.error || res.data == null) {
    throw new ProvisioningError(`${what} failed: ${res.error?.message ?? "no data"}`, res.error?.status);
  }
  return res.data;
}

function toIdentity(u: RawUser): Identity {
  return { id: u.id, email: u.email.toLowerCase(), banned: !!u.banned };
}

export function createIdentityAdmin(env: Env = process.env): IdentityAdmin {
  const { baseUrl, cookieSecret } = getNeonAuthSettings(env);
  const provisioner = getProvisionerCredentials(env);
  const origin = getAppOrigin(env);

  /** Runs `fn` with a freshly signed-in service-account client, then signs it out. */
  async function asProvisioner<T>(fn: (server: Server) => Promise<T>): Promise<T> {
    const jar = new Map<string, string>();
    const server = createAuthServer({
      baseUrl,
      cookieSecret,
      sessionDataTtl: SESSION_DATA_TTL_SECONDS,
      log: silent,
      context: () => ({
        getCookies: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        setCookie: (name, value, options) => {
          if (!value || options.maxAge === 0) jar.delete(name);
          else jar.set(name, value);
        },
        getHeader: () => null,
        getOrigin: () => origin,
        getFramework: () => "wortweg-provisioner",
      }),
    });
    const signIn = (await server.signIn.email({ email: provisioner.email, password: provisioner.password })) as ApiResult<unknown>;
    if (signIn.error) {
      throw new ProvisioningError(
        `The account service could not sign in (${signIn.error.status}). Check AUTH_PROVISIONER_* and that the account has the Neon Auth admin role.`,
        signIn.error.status,
      );
    }
    try {
      return await fn(server);
    } finally {
      await server.signOut().catch(() => undefined);
    }
  }

  async function listBy(server: Server, field: "email" | "id", value: string): Promise<Identity | null> {
    const query =
      field === "email"
        ? ({ searchField: "email", searchOperator: "contains", searchValue: value, limit: 50 } as const)
        : ({ filterField: "id", filterOperator: "eq", filterValue: value, limit: 1 } as const);
    const data = unwrap((await server.admin.listUsers({ query })) as ApiResult<{ users: RawUser[] }>, "Listing accounts");
    const match = data.users.find((u) => (field === "email" ? u.email.toLowerCase() === value : u.id === value));
    return match ? toIdentity(match) : null;
  }

  return {
    async createIdentity({ email, password, name }) {
      return asProvisioner(async (server) => {
        const res = (await server.admin.createUser({ email: email.toLowerCase(), password, name, role: "user" })) as ApiResult<{ user: RawUser }>;
        if (res.error) {
          if (await listBy(server, "email", email.toLowerCase())) {
            throw new ProvisioningError("A sign-in account with this email already exists in Neon Auth.", 409);
          }
          unwrap(res, "Creating the sign-in account");
        }
        return toIdentity(res.data!.user);
      });
    },
    findIdentityByEmail: (email) => asProvisioner((server) => listBy(server, "email", email.toLowerCase())),
    findIdentityById: (id) => asProvisioner((server) => listBy(server, "id", id)),
    async setPassword(id, password) {
      await asProvisioner(async (server) => {
        unwrap((await server.admin.setUserPassword({ userId: id, newPassword: password })) as ApiResult<unknown>, "Setting the password");
        // End existing sessions so the old password's sessions don't linger.
        await server.admin.revokeUserSessions({ userId: id });
      });
    },
    async disable(id) {
      await asProvisioner(async (server) => {
        unwrap((await server.admin.banUser({ userId: id, banReason: "Deactivated in Wortweg" })) as ApiResult<unknown>, "Disabling sign-in");
        await server.admin.revokeUserSessions({ userId: id });
      });
    },
    async enable(id) {
      await asProvisioner(async (server) => {
        unwrap((await server.admin.unbanUser({ userId: id })) as ApiResult<unknown>, "Enabling sign-in");
      });
    },
    async remove(id) {
      await asProvisioner(async (server) => {
        unwrap((await server.admin.removeUser({ userId: id })) as ApiResult<unknown>, "Removing the sign-in account");
      });
    },
  };
}
