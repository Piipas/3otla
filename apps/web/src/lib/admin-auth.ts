/**
 * Admin sign-in with GitHub. Only accounts listed in ADMIN_GITHUB_USERS get a session.
 *
 * - OAuth: /api/admin/login → GitHub → /api/admin/callback (state cookie checked).
 * - Session: httpOnly cookie `login.exp.signature`, HMAC-SHA256 with ADMIN_SESSION_SECRET.
 *   We keep no GitHub token. The allowlist is checked again on every request, so removing
 *   someone from ADMIN_GITHUB_USERS revokes their access at once.
 */
type Env = Record<string, string | undefined>;

export const SESSION_COOKIE = "3otla_admin";
export const STATE_COOKIE = "3otla_oauth_state";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
/** Local development only: lets you try /admin without a GitHub app. */
export const DEV_ADMIN = "dev";

export interface AdminConfig {
  clientId: string;
  clientSecret: string;
  secret: string;
  admins: string[];
}

export function adminConfig(env: Env): AdminConfig | null {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const secret = env.ADMIN_SESSION_SECRET;
  const admins = (env.ADMIN_GITHUB_USERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!clientId || !clientSecret || !secret || secret.length < 32 || admins.length === 0) {
    return null;
  }
  return { clientId, clientSecret, secret, admins };
}

/** Secret for signing sessions: the configured one, or a fixed one in local development. */
export function sessionSecret(env: Env): string | null {
  if (env.ADMIN_SESSION_SECRET && env.ADMIN_SESSION_SECRET.length >= 32) {
    return env.ADMIN_SESSION_SECRET;
  }
  return env.NODE_ENV === "development" ? "development-only-session-secret-0000000000" : null;
}

export function isAllowed(login: string, env: Env): boolean {
  const name = login.toLowerCase();
  if (name === DEV_ADMIN) return env.NODE_ENV === "development";
  return (env.ADMIN_GITHUB_USERS ?? "").split(",").some((s) => s.trim().toLowerCase() === name);
}

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(login: string, secret: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = `${login}.${exp}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${base64url(sig)}`;
}

/** The admin login in a valid, unexpired session cookie, or null. */
export async function verifySession(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<string | null> {
  const parts = value?.split(".");
  if (parts?.length !== 3) return null;
  const [login, exp, sig] = parts as [string, string, string];
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login) || !/^\d+$/.test(exp)) return null;
  if (Number(exp) * 1000 < now) return null;
  const signature = new Uint8Array(Buffer.from(sig, "base64url"));
  // crypto.subtle.verify compares in constant time.
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signature,
    encoder.encode(`${login}.${exp}`),
  );
  return ok ? login : null;
}

export const cookieOptions = (maxAge: number) =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  }) as const;
