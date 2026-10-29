import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import {
  adminConfig,
  cookieOptions,
  DEV_ADMIN,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  STATE_COOKIE,
  sessionSecret,
  signSession,
} from "@/lib/admin-auth";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Starts GitHub sign-in. In local development without a GitHub app, signs in as "dev". */
export async function GET(request: NextRequest) {
  const wanted = request.nextUrl.searchParams.get("locale") ?? "";
  const locale = (routing.locales as readonly string[]).includes(wanted)
    ? wanted
    : routing.defaultLocale;
  const config = adminConfig(process.env);

  if (!config) {
    const secret = sessionSecret(process.env);
    if (process.env.NODE_ENV === "development" && secret) {
      const res = NextResponse.redirect(new URL(`/${locale}/admin`, request.url));
      res.cookies.set(SESSION_COOKIE, await signSession(DEV_ADMIN, secret), {
        ...cookieOptions(SESSION_TTL_SECONDS),
      });
      return res;
    }
    return NextResponse.redirect(new URL(`/${locale}/admin?error=not_configured`, request.url));
  }

  const state = crypto.randomUUID();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", `${SITE_URL}/api/admin/callback`);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");
  // No scope: we only read the public profile to learn who signed in.
  const res = NextResponse.redirect(authorize);
  res.cookies.set(STATE_COOKIE, `${state}:${locale}`, { ...cookieOptions(600) });
  return res;
}
