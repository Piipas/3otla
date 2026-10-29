import { cookies } from "next/headers";
import { isAllowed, SESSION_COOKIE, sessionSecret, verifySession } from "./admin-auth";

/** GitHub login of the signed-in admin, or null. Re-checks the allowlist every time. */
export async function currentAdmin(): Promise<string | null> {
  const secret = sessionSecret(process.env);
  if (!secret) return null;
  const login = await verifySession((await cookies()).get(SESSION_COOKIE)?.value, secret);
  return login && isAllowed(login, process.env) ? login : null;
}
