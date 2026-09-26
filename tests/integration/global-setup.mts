/** Starts the local Neon Auth stand-in once for all DB-backed integration tests. */
import { startNeonAuthEmulator } from "../support/neon-auth-emulator.mts";
import { INTEGRATION_AUTH_ENV } from "./auth-env";

export default async function setup() {
  const url = new URL(INTEGRATION_AUTH_ENV.NEON_AUTH_BASE_URL);
  const emulator = await startNeonAuthEmulator({
    port: Number(url.port),
    appOrigins: [INTEGRATION_AUTH_ENV.APP_ORIGIN],
    provisioner: { email: INTEGRATION_AUTH_ENV.AUTH_PROVISIONER_EMAIL, password: INTEGRATION_AUTH_ENV.AUTH_PROVISIONER_PASSWORD },
  });
  return () => emulator.close();
}
