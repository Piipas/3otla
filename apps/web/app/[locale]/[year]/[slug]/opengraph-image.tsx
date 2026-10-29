import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { occurrencesStartingIn } from "@/lib/holidays";
import { holidayOgImage, OG_SIZE } from "@/lib/og";
import { parseYear } from "@/lib/site";

export const size = OG_SIZE;
export const contentType = "image/png";
// The "in N days" pill changes daily.
export const revalidate = 86400;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: AppLocale; year: string; slug: string }>;
}) {
  const { locale, year: rawYear, slug } = await params;
  const year = parseYear(rawYear);
  const [occ] = year ? occurrencesStartingIn(year, slug) : [];
  if (!occ) return new Response("Not found", { status: 404 });
  const t = await getTranslations({ locale });
  return holidayOgImage(occ, locale, {
    kicker: t(`calendars.${occ.calendar}`),
    status: t(`status.${occ.status}`),
    inDays: (count) => t("holiday.inDays", { count }),
    site: "3otla · عطلة",
  });
}
