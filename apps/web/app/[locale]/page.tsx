import { addDays, nextHolidays, startOfDayInCasablanca, todayInCasablanca } from "@3otla/core";
import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Countdown } from "@/components/countdown";
import { HolidayList } from "@/components/holiday-list";
import { FadeIn } from "@/components/motion";
import { StatusBadge } from "@/components/status-badge";
import { SubscribeMenu } from "@/components/subscribe-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatDate, formatHijri, formatOccurrenceDates } from "@/lib/format";
import { feedLinks } from "@/lib/site";

// "Next holiday" depends on today: regenerate hourly.
export const revalidate = 3600;

export default async function HomePage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const today = todayInCasablanca();
  const [next, ...upcoming] = nextHolidays(today, 7);
  if (!next) return null;
  const ongoing = next.date <= today;
  const year = Number(today.slice(0, 4));

  return (
    <>
      <FadeIn className="pt-10 pb-6 sm:pt-14">
        <h1 className="max-w-2xl text-balance text-lg text-muted">{t("home.intro")}</h1>
      </FadeIn>

      <FadeIn delay={0.05}>
        <section
          aria-labelledby="next-holiday"
          className="relative isolate overflow-hidden rounded-xl bg-linear-to-br from-brand to-brand-deep px-6 py-10 text-white shadow-[0_30px_80px_-40px_var(--brand)] sm:px-12 sm:py-14 dark:from-[#3b46c9] dark:to-brand-deep"
        >
          <div
            aria-hidden="true"
            className="zellige pointer-events-none absolute inset-0 -z-10 mask-l-from-10% mask-l-to-90% rtl:mask-r-from-10% rtl:mask-r-to-90% rtl:mask-l-from-100%"
          />
          <p className="text-sm font-medium tracking-wide text-white/75 uppercase">
            {ongoing ? t("home.today") : t("home.kicker")}
          </p>
          <h2
            id="next-holiday"
            className="mt-3 text-4xl leading-tight font-semibold text-balance sm:text-6xl"
          >
            <Link href={`/${next.date.slice(0, 4)}/${next.id}`} className="hover:underline">
              {next.labels[locale]}
            </Link>
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-white/85">
            <span className="text-lg">{formatOccurrenceDates(next, locale)}</span>
            {next.hijri ? (
              <span className="text-white/60">{formatHijri(next.hijri, locale)}</span>
            ) : null}
            <StatusBadge occurrence={next} className="ring-white/30" />
          </div>

          <div className="mt-10">
            <Countdown
              start={startOfDayInCasablanca(next.date).toISOString()}
              end={startOfDayInCasablanca(addDays(next.endDate, 1)).toISOString()}
              ongoingLabel={t("home.inProgress", {
                date: formatDate(next.endDate, locale),
              })}
            />
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <SubscribeMenu
              variant="onBrand"
              feed={feedLinks("all", locale)}
              calendarLabel={t("calendars.all")}
            />
            <Button asChild variant="onBrand">
              <Link href={`/${year}`}>
                {t("home.seeCalendar", { year })}
                <ArrowRight className="rtl:-scale-x-100" />
              </Link>
            </Button>
          </div>
        </section>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-14">
        <section aria-labelledby="upcoming">
          <h2 id="upcoming" className="mb-5 text-2xl font-semibold">
            {t("home.upcoming")}
          </h2>
          <HolidayList holidays={upcoming} today={today} />
        </section>
      </FadeIn>
    </>
  );
}
