import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { SESSION_COOKIE } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Signs out (POST only, from the admin page's form). */
export async function POST(request: NextRequest) {
  // Same-origin check: browsers send Origin on POST.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const wanted = String(form?.get("locale") ?? "");
  const locale = (routing.locales as readonly string[]).includes(wanted)
    ? wanted
    : routing.defaultLocale;
  const res = NextResponse.redirect(new URL(`/${locale}/admin`, request.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
