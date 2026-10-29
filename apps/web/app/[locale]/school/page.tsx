import {
  addDays,
  diffDays,
  nextSchoolBreaks,
  type SchoolBreak,
  type SchoolCalendarId,
  type SchoolYear,
  schoolYear,
  startOfDayInCasablanca,
  todayInCasablanca,
} from "@3otla/core";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Countdown } from "@/components/countdown";
import { FadeIn } from "@/components/motion";
import { StatusBadge } from "@/components/status-badge";
import { SubscribeMenu } from "@/components/subscribe-menu";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatDate, formatHijri, formatOccurrenceDates } from "@/lib/format";
import { alternates, currentYear, feedLinks } from "@/lib/site";
import { cn } from "@/lib/utils";

// "Next break" depends on today: regenerate hourly.
export const revalidate = 3600;

type Params = Promise<{ locale: AppLocale }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "school" });
  const { schoolYear: label } = schoolYear("school-public");
  return {
    title: t("title", { schoolYear: label.replace("-", "/") }),
    description: t("metaDescription", { schoolYear: label.replace("-", "/") }),
    alternates: alternates(locale, "/school"),
  };
}

export default async function SchoolPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const today = todayInCasablanca();
  const calendars: SchoolCalendarId[] = ["school-public", "school-aefe"];
  const years = calendars.map((c) => schoolYear(c, undefined, today));
  const label = (years[0] as SchoolYear).schoolYear.replace("-", "/");

  return (
    <>
      <FadeIn className="pt-10 pb-8 sm:pt-14">
        <h1 className="text-4xl font-semibold sm:text-5xl">
          {t("school.title", { schoolYear: label })}
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-muted">{t("school.intro")}</p>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          {t("school.notHolidays")}{" "}
          <Link href={`/${currentYear()}`} className="text-brand underline underline-offset-4">
            {t("school.publicHolidays")}
          </Link>
        </p>
      </FadeIn>

      <div className="grid gap-8 lg:grid-cols-2">
        {years.map((year, i) => (
          <FadeIn key={year.calendar} delay={0.05 * (i + 1)}>
            <SchoolCalendarCard year={year} today={today} locale={locale} />
          </FadeIn>
        ))}
      </div>
    </>
  );
}

async function SchoolCalendarCard({
  year,
  today,
  locale,
}: {
  year: SchoolYear;
  today: string;
  locale: AppLocale;
}) {
  const t = await getTranslations();
  const isPublic = year.calendar === "school-public";
  const [next] = nextSchoolBreaks(today, year.calendar, 1);
  const upcoming = next && next.schoolYear === year.schoolYear ? next : undefined;

  return (
    <Card id={year.calendar} className="scroll-mt-24 overflow-hidden">
      <div
        className={cn(
          "relative isolate overflow-hidden px-6 py-7 text-white sm:px-8",
          isPublic
            ? "bg-linear-to-br from-brand to-brand-deep"
            : "bg-linear-to-br from-accent to-[#8f3a22]",
        )}
      >
        <div
          aria-hidden="true"
          className="zellige pointer-events-none absolute inset-0 -z-10 opacity-70"
        />
        <h2 className="text-2xl font-semibold">{t(isPublic ? "school.public" : "school.aefe")}</h2>
        <p className="mt-1 text-sm text-white/75">
          {t(isPublic ? "school.publicSub" : "school.aefeSub")}
        </p>

        {upcoming ? (
          <div className="mt-6">
            <p className="text-xs font-medium tracking-wide text-white/70 uppercase">
              {t("school.next")}
            </p>
            <p className="mt-1 text-xl font-semibold">{upcoming.labels[locale]}</p>
            <p className="text-sm text-white/80">{formatOccurrenceDates(upcoming, locale)}</p>
            <div className="mt-5">
              <Countdown
                start={startOfDayInCasablanca(upcoming.date).toISOString()}
                end={startOfDayInCasablanca(addDays(upcoming.endDate, 1)).toISOString()}
                ongoingLabel={t("school.inProgress", {
                  date: formatDate(upcoming.endDate, locale),
                })}
              />
            </div>
          </div>
        ) : (
          <p className="mt-6 text-white/80">{t("school.over")}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 border-b border-line p-6 text-sm sm:px-8">
        <div>
          <dt className="text-muted">{t("school.classesStart")}</dt>
          <dd className="mt-1 font-medium">{formatDate(year.classesStart, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("school.classesEnd")}</dt>
          <dd className="mt-1 font-medium">{formatDate(year.classesEnd, locale)}</dd>
          {year.classesEndExceptions.map((e) => (
            <dd key={e.date} className="mt-1 text-xs text-muted">
              {e.labels[locale]} — {formatDate(e.date, locale, { day: "numeric", month: "long" })}
            </dd>
          ))}
        </div>
      </dl>

      <section aria-labelledby={`${year.calendar}-breaks`} className="p-6 sm:px-8">
        <h3 id={`${year.calendar}-breaks`} className="mb-4 font-semibold">
          {t("school.breaks")}
        </h3>
        <ol className="space-y-3">
          {year.breaks.map((b) => (
            <BreakRow key={b.key} item={b} today={today} locale={locale} />
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5 text-sm">
          <a
            href={year.sourceUrl}
            target="_blank"
            rel="noopener"
            className="me-auto inline-flex items-center gap-1.5 text-brand underline decoration-brand/30 underline-offset-4"
          >
            {t("school.source")}
            {year.decisionRefs?.[0]?.kind === "ministerial-decision"
              ? ` ${year.decisionRefs[0].ref}`
              : ""}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          <SubscribeMenu
            variant="outline"
            feed={feedLinks(year.calendar, locale)}
            calendarLabel={t(`calendars.${year.calendar}`)}
          />
        </div>
      </section>
    </Card>
  );
}

async function BreakRow({
  item,
  today,
  locale,
}: {
  item: SchoolBreak;
  today: string;
  locale: AppLocale;
}) {
  const t = await getTranslations();
  const past = item.endDate < today;
  const current = item.date <= today && !past;
  return (
    <li
      data-state={past ? "past" : current ? "current" : "upcoming"}
      className="flex items-center gap-4 rounded-lg p-2 data-[state=current]:bg-estimated-soft/50 data-[state=past]:opacity-55"
    >
      <div className="flex w-12 shrink-0 flex-col items-center rounded-arch bg-surface-2 px-1 pt-2.5 pb-1.5 text-center ring-1 ring-line">
        <span className="text-lg leading-none font-semibold tabular-nums">
          {Number(item.date.slice(8))}
        </span>
        <span className="mt-0.5 text-[0.65rem] text-muted">
          {formatDate(item.date, locale, { month: "short" })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.labels[locale]}</p>
        <p className="text-sm text-muted">
          {formatOccurrenceDates(item, locale)} · {t("holiday.days", { count: item.durationDays })}
          {item.hijri
            ? ` · ${formatHijri({ year: item.hijri.year, ...item.hijri.from }, locale)}`
            : ""}
          {!past && !current
            ? ` · ${t("holiday.inDays", { count: diffDays(today, item.date) })}`
            : ""}
        </p>
      </div>
      {item.status !== "fixed" ? <StatusBadge occurrence={item} /> : null}
    </li>
  );
}
