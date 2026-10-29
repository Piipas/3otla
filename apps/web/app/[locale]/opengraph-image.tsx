import { nextHolidays, todayInCasablanca } from "@3otla/core";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { holidayOgImage, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

/** Home share card: the next holiday. */
export default async function Image({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const [next] = nextHolidays(todayInCasablanca(), 1);
  if (!next) return new Response("Not found", { status: 404 });
  const t = await getTranslations({ locale });
  return holidayOgImage(next, locale, {
    kicker: t("home.kicker"),
    status: t(`status.${next.status}`),
    inDays: (count) => t("holiday.inDays", { count }),
    site: "3otla · عطلة",
  });
}
