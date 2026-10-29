import {
  addDays,
  diffDays,
  type HolidayOccurrence,
  nextSchoolBreaks,
  type SchoolBreak,
  schoolYear,
  startOfDayInCasablanca,
  todayInCasablanca,
} from "@3otla/core";
import { ArrowUpRight, ExternalLink, FileText, MessageSquareWarning } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Countdown } from "@/components/countdown";
import { FadeIn } from "@/components/motion";
import { StatusBadge } from "@/components/status-badge";
import { SubscribeMenu } from "@/components/subscribe-menu";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatDate, formatHijri, formatOccurrenceDates } from "@/lib/format";
import { alternates, currentYear, feedLinks } from "@/lib/site";
import { cn } from "@/lib/utils";

// "Next break" depends on today: regenerate hourly.
export const revalidate = 3600;

const CALENDAR = "school-public";

type Params = Promise<{ locale: AppLocale }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "school" });
  const { schoolYear: label } = schoolYear(CALENDAR);
  return {
    title: t("title", { schoolYear: label.replace("-", "/") }),
    description: t("metaDescription", { schoolYear: label.replace("-", "/") }),
    alternates: alternates(locale, "/school"),
  };
}

/** One row of the annex: a school break or a public holiday during the school year. */
type DayOff = { kind: "break"; item: SchoolBreak } | { kind: "holiday"; item: HolidayOccurrence };

export default async function SchoolPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const today = todayInCasablanca();
  const year = schoolYear(CALENDAR, undefined, today);
  const label = year.schoolYear.replace("-", "/");
  const [next] = nextSchoolBreaks(today, CALENDAR, 1);
  const upcoming = next && next.schoolYear === year.schoolYear ? next : undefined;
  const decision = year.decisionRefs?.find((d) => d.kind === "ministerial-decision");

  const daysOff: DayOff[] = [
    ...year.breaks.map((item) => ({ kind: "break" as const, item })),
    ...year.publicHolidays.map((item) => ({ kind: "holiday" as const, item })),
  ].sort((a, b) => a.item.date.localeCompare(b.item.date));

  return (
    <>
      <FadeIn className="pt-10 pb-8 sm:pt-14">
        <h1 className="text-4xl font-semibold text-balance sm:text-5xl">
          {t("school.title", { schoolYear: label })}
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-pretty text-muted">{t("school.intro")}</p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <section
          id={CALENDAR}
          aria-labelledby="next-break"
          className="relative isolate scroll-mt-24 overflow-hidden rounded-xl bg-linear-to-br from-hero-from to-hero-to px-6 py-9 text-white shadow-[0_30px_80px_-40px_var(--hero-from)] sm:px-12 sm:py-12"
        >
          <div
            aria-hidden="true"
            className="zellige pointer-events-none absolute inset-0 -z-10 mask-l-from-10% mask-l-to-90% rtl:mask-r-from-10% rtl:mask-r-to-90% rtl:mask-l-from-100%"
          />
          {upcoming ? (
            <>
              <p className="text-sm font-medium tracking-wide text-white/75 uppercase">
                {t("school.next")}
              </p>
              <h2 id="next-break" className="mt-3 text-3xl font-semibold text-balance sm:text-5xl">
                {upcoming.labels[locale]}
              </h2>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-lg text-white/85">
                <span>{formatOccurrenceDates(upcoming, locale)}</span>
                <span className="text-white/65">
                  {t("holiday.days", { count: upcoming.durationDays })}
                </span>
              </p>
              <div className="mt-8">
                <Countdown
                  start={startOfDayInCasablanca(upcoming.date).toISOString()}
                  end={startOfDayInCasablanca(addDays(upcoming.endDate, 1)).toISOString()}
                  ongoingLabel={t("school.inProgress", {
                    date: formatDate(upcoming.endDate, locale),
                  })}
                />
              </div>
            </>
          ) : (
            <h2 id="next-break" className="text-2xl font-semibold">
              {t("school.over")}
            </h2>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <SubscribeMenu
              variant="onBrand"
              feed={feedLinks(CALENDAR, locale)}
              calendarLabel={t(`calendars.${CALENDAR}`)}
            />
            <a
              href={year.sourceUrl}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "onBrand" })}
            >
              <FileText aria-hidden="true" />
              {t("school.source")}
            </a>
          </div>
        </section>
      </FadeIn>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <FadeIn delay={0.1}>
          <section aria-labelledby="days-off">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="days-off" className="text-2xl font-semibold">
                {t("school.daysOff")}
              </h2>
              <p className="text-sm text-muted">
                {t("school.summary", {
                  breaks: year.breaks.length,
                  holidays: year.publicHolidays.length,
                })}
              </p>
            </div>
            <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {daysOff.map((d) => (
                <DayOffRow key={d.item.key} dayOff={d} today={today} locale={locale} />
              ))}
            </ol>
          </section>
        </FadeIn>

        <FadeIn delay={0.15} className="space-y-6 lg:sticky lg:top-24">
          <Card className="p-6">
            <h2 className="font-semibold">{t("school.keyDates")}</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-muted">{t("school.classesStart")}</dt>
                <dd className="mt-1 font-medium">{formatDate(year.classesStart, locale)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("school.classesEnd")}</dt>
                <dd className="mt-1 font-medium">{formatDate(year.classesEnd, locale)}</dd>
                {year.classesEndExceptions.map((e) => (
                  <dd key={e.date} className="mt-1 text-muted">
                    {e.labels[locale]} — {formatDate(e.date, locale)}
                  </dd>
                ))}
              </div>
            </dl>
          </Card>

          <Card className="p-6 text-sm">
            <h2 className="font-semibold">{t("school.source")}</h2>
            <p className="mt-3 text-muted">
              {decision ? t("school.decision", { ref: decision.ref }) : null}
              <br />
              {t("school.issued", { date: formatDate(year.issuedAt, locale) })}
            </p>
            <a
              href={year.sourceUrl}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
            >
              men.gov.ma
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
            <p className="mt-3 border-t border-line pt-4 text-muted">
              {t("school.notHolidays")}{" "}
              <Link href={`/${currentYear()}`} className="text-brand underline underline-offset-4">
                {t("school.publicHolidays")}
              </Link>
            </p>
            <Link
              href={`/contribute?kind=school-calendar&schoolYear=${year.schoolYear}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
            >
              <MessageSquareWarning aria-hidden="true" />
              {t("contribute.suggestFix")}
            </Link>
          </Card>
        </FadeIn>
      </div>
    </>
  );
}

async function DayOffRow({
  dayOff,
  today,
  locale,
}: {
  dayOff: DayOff;
  today: string;
  locale: AppLocale;
}) {
  const t = await getTranslations();
  const { item } = dayOff;
  const past = item.endDate < today;
  const current = item.date <= today && !past;
  const isBreak = dayOff.kind === "break";
  const hijri =
    dayOff.kind === "break"
      ? dayOff.item.hijri && { year: dayOff.item.hijri.year, ...dayOff.item.hijri.from }
      : dayOff.item.hijri;

  return (
    <li
      data-state={past ? "past" : current ? "current" : "upcoming"}
      data-kind={dayOff.kind}
      className="group relative flex items-center gap-4 p-4 transition-colors data-[state=current]:bg-estimated-soft/40 data-[state=past]:text-muted sm:gap-5 sm:px-5"
    >
      <div
        className={cn(
          "flex w-14 shrink-0 flex-col items-center rounded-arch px-1 pt-3 pb-2 text-center ring-1",
          isBreak ? "bg-brand/10 text-brand ring-brand/20" : "bg-surface-2 ring-line",
          past && "opacity-60",
        )}
      >
        <span className="text-xl leading-none font-semibold tabular-nums">
          {Number(item.date.slice(8))}
        </span>
        <span className="mt-1 text-[0.7rem]">
          {formatDate(item.date, locale, { month: "short" })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">
            {isBreak ? (
              item.labels[locale]
            ) : (
              <Link
                href={`/${item.date.slice(0, 4)}/${item.id}`}
                className="after:absolute after:inset-0 hover:text-brand"
              >
                {item.labels[locale]}
              </Link>
            )}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              isBreak ? "bg-brand/10 text-brand" : "bg-surface-2 text-muted",
            )}
          >
            {isBreak ? t("school.kindBreak") : t("school.kindHoliday")}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {formatOccurrenceDates(item, locale)}
          {item.durationDays > 1 ? ` · ${t("holiday.days", { count: item.durationDays })}` : ""}
          {hijri ? ` · ${formatHijri(hijri, locale)}` : ""}
          {!past && !current
            ? ` · ${t("holiday.inDays", { count: diffDays(today, item.date) })}`
            : ""}
        </p>
      </div>
      {item.status !== "fixed" ? (
        <StatusBadge occurrence={item} className="relative z-10 hidden sm:inline-flex" />
      ) : null}
      {isBreak ? null : (
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted transition group-hover:text-brand rtl:-scale-x-100"
        />
      )}
    </li>
  );
}
