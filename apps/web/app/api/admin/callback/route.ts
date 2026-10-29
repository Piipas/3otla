import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import {
  adminConfig,
  cookieOptions,
  isAllowed,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  STATE_COOKIE,
  signSession,
} from "@/lib/admin-auth";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** GitHub redirects here after sign-in. Only allowlisted accounts get a session. */
export async function GET(request: NextRequest) {
  const [expectedState, rawLocale] = (request.cookies.get(STATE_COOKIE)?.value ?? "").split(":");
  const locale =
    rawLocale && (routing.locales as readonly string[]).includes(rawLocale)
      ? rawLocale
      : routing.defaultLocale;
  const back = (error?: string) => {
    const res = NextResponse.redirect(
      new URL(`/${locale}/admin${error ? `?error=${error}` : ""}`, request.url),
    );
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  const config = adminConfig(process.env);
  if (!config) return back("not_configured");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || !expectedState || state !== expectedState) return back("oauth");

  let login: string;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: `${SITE_URL}/api/admin/callback`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const { access_token: token } = (await tokenRes.json()) as { access_token?: string };
    if (!token) return back("oauth");
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "3otla-admin",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!userRes.ok) return back("oauth");
    ({ login } = (await userRes.json()) as { login: string });
  } catch (error) {
    console.error("[admin] GitHub sign-in failed", error);
    return back("oauth");
  }

  if (!isAllowed(login, process.env)) {
    console.warn(`[admin] refused sign-in for GitHub user ${login}`);
    return back("forbidden");
  }
  const res = back();
  res.cookies.set(SESSION_COOKIE, await signSession(login, config.secret), {
    ...cookieOptions(SESSION_TTL_SECONDS),
  });
  return res;
}
