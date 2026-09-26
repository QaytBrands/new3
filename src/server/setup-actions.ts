"use server";

import { redirect } from "next/navigation";
import { createIdentityAdmin } from "@/lib/auth/provisioning";
import { NeonAuthConfigError } from "@/lib/auth/neon-config";
import { ProvisioningError } from "@/lib/auth/provisioning";
import { runFirstTimeSetup } from "@/lib/setup";

export type SetupState = { error?: string };

export async function completeSetup(_: SetupState, fd: FormData): Promise<SetupState> {
  const str = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");
  try {
    const res = await runFirstTimeSetup(
      {
        setupKey: str("setupKey"),
        name: str("name"),
        email: str("email"),
        password: str("password"),
        loadSample: fd.get("loadSample") === "on",
      },
      () => createIdentityAdmin(),
    );
    if (!res.ok) return { error: res.error };
  } catch (e) {
    if (e instanceof NeonAuthConfigError || e instanceof ProvisioningError) return { error: e.message };
    throw e;
  }
  redirect("/admin/login?setup=done");
}
