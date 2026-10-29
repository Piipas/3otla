import { SUPPORTED_YEARS } from "@3otla/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HolidayList } from "@/components/holiday-list";
import { FadeIn } from "@/components/motion";
import { SubscribeMenu } from "@/components/subscribe-menu";
import { buttonVariants } from "@/components/ui/button";
import { CalendarLegend, YearCalendar } from "@/components/year-calendar";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { holidaysStartingIn } from "@/lib/holidays";
import { alternates, feedLinks, parseYear, staticYears } from "@/lib/site";
import { cn } from "@/lib/utils";

type Params = Promise<{ locale: AppLocale; year: string }>;

export function generateStaticParams() {
  return staticYears().map((year) => ({ year: String(year) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, year: raw } = await params;
  const year = parseYear(raw);
  if (!year) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("yearTitle", { year }),
    description: t("yearDescription", { year }),
    alternates: alternates(locale, `/${year}`),
  };
}

export default async function YearPage({ params }: { params: Params }) {
  const { locale, year: raw } = await params;
  setRequestLocale(locale);
  const year = parseYear(raw);
  if (!year) notFound();
  const t = await getTranslations();
  const holidays = holidaysStartingIn(year);
  const prev = year > SUPPORTED_YEARS.min ? year - 1 : null;
  const next = year < SUPPORTED_YEARS.max ? year + 1 : null;
  const navBtn = cn(buttonVariants({ variant: "outline", size: "icon" }));

  return (
    <>
      <div className="flex flex-wrap items-end gap-4 pt-10 pb-8 sm:pt-14">
        <div className="me-auto">
          <h1 className="text-4xl font-semibold sm:text-5xl">{t("meta.yearTitle", { year })}</h1>
          <p className="mt-2 text-muted">{t("calendar.count", { count: holidays.length })}</p>
        </div>
        <nav aria-label={t("calendar.title", { year })} className="flex items-center gap-2">
          {prev ? (
            <Link href={`/${prev}`} className={navBtn} aria-label={t("calendar.prev")} rel="prev">
              <ChevronLeft className="rtl:-scale-x-100" />
            </Link>
          ) : null}
          <span className="min-w-16 text-center text-lg font-semibold tabular-nums">{year}</span>
          {next ? (
            <Link href={`/${next}`} className={navBtn} aria-label={t("calendar.next")} rel="next">
              <ChevronRight className="rtl:-scale-x-100" />
            </Link>
          ) : null}
        </nav>
        <SubscribeMenu
          variant="outline"
          feed={feedLinks("all", locale)}
          calendarLabel={t("calendars.all")}
        />
      </div>

      <FadeIn key={year}>
        <div className="rounded-xl border border-line bg-surface p-5 sm:p-8">
          <div className="mb-6">
            <h2 className="sr-only">{t("calendar.legend")}</h2>
            <CalendarLegend
              labels={{
                fixed: t("status.fixed"),
                estimated: t("status.estimated"),
                confirmed: t("status.confirmed"),
                weekend: t("calendar.weekend"),
                today: t("calendar.today"),
              }}
            />
          </div>
          <YearCalendar year={year} />
        </div>

        <section aria-labelledby="list" className="mt-14">
          <h2 id="list" className="mb-5 text-2xl font-semibold">
            {t("calendar.list", { year })}
          </h2>
          <HolidayList holidays={holidays} />
        </section>
      </FadeIn>
    </>
  );
}
