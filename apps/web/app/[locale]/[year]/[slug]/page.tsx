import { addDays, type HolidayOccurrence, startOfDayInCasablanca } from "@3otla/core";
import { ExternalLink, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Countdown } from "@/components/countdown";
import { FadeIn } from "@/components/motion";
import { StatusBadge } from "@/components/status-badge";
import { SubscribeMenu } from "@/components/subscribe-menu";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatDate, formatHijri, formatOccurrenceDates } from "@/lib/format";
import { definition, HOLIDAY_IDS, occurrencesStartingIn, yearsWithHoliday } from "@/lib/holidays";
import { alternates, feedLinks, parseYear, SITE_URL, staticYears } from "@/lib/site";
import { cn } from "@/lib/utils";

type Params = Promise<{ locale: AppLocale; year: string; slug: string }>;

export function generateStaticParams() {
  return staticYears().flatMap((year) =>
    HOLIDAY_IDS.filter((id) => occurrencesStartingIn(year, id).length > 0).map((slug) => ({
      year: String(year),
      slug,
    })),
  );
}

function load(rawYear: string, slug: string) {
  const year = parseYear(rawYear);
  const def = definition(slug);
  if (!year || !def) return null;
  const occurrences = occurrencesStartingIn(year, slug);
  return occurrences.length > 0 ? { year, def, occurrences } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, year: rawYear, slug } = await params;
  const data = load(rawYear, slug);
  if (!data) return {};
  const t = await getTranslations({ locale });
  const [occ] = data.occurrences as [HolidayOccurrence];
  const name = occ.labels[locale];
  return {
    title: t("meta.holidayTitle", { name, year: data.year }),
    description: t("meta.holidayDescription", {
      name,
      year: data.year,
      date: formatOccurrenceDates(occ, locale),
      status: t(`status.${occ.status}`),
    }),
    alternates: alternates(locale, `/${data.year}/${slug}`),
  };
}

export default async function HolidayPage({ params }: { params: Params }) {
  const { locale, year: rawYear, slug } = await params;
  setRequestLocale(locale);
  const data = load(rawYear, slug);
  if (!data) notFound();
  const { year, def, occurrences } = data;
  const t = await getTranslations();
  const name = def.labels[locale];

  const jsonLd = occurrences.map((occ) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${name} ${year}`,
    startDate: occ.date,
    endDate: occ.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Country", name: "Morocco", identifier: "MA" },
    description: t(`status.${occ.status}Help`),
    url: `${SITE_URL}/${locale}/${year}/${slug}`,
    inLanguage: locale,
    isAccessibleForFree: true,
  }));

  return (
    <article className="pt-10 sm:pt-14">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD, escaped below
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          {t("nav.home")}
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/${year}`} className="hover:text-ink">
          {year}
        </Link>
      </nav>

      <FadeIn>
        <p className="text-sm font-medium text-accent">{t(`calendars.${def.calendar}`)}</p>
        <h1 className="mt-2 text-4xl font-semibold text-balance sm:text-6xl">
          {name} <span className="text-muted">{year}</span>
        </h1>
      </FadeIn>

      {occurrences.map((occ, i) => (
        <FadeIn key={occ.key} delay={0.05 * (i + 1)} className="mt-8">
          <Card className="overflow-hidden">
            <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-2xl font-medium sm:text-3xl">
                  {formatOccurrenceDates(occ, locale)}
                </p>
                <p className="mt-2 text-muted">
                  {t("holiday.days", { count: occ.durationDays })}
                  {occ.hijri ? ` · ${formatHijri(occ.hijri, locale)}` : ""}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <StatusBadge occurrence={occ} size="md" />
                  <p className="text-sm text-muted">{t(`status.${occ.status}Help`)}</p>
                </div>
              </div>
              <Countdown
                tone="surface"
                start={startOfDayInCasablanca(occ.date).toISOString()}
                end={startOfDayInCasablanca(addDays(occ.endDate, 1)).toISOString()}
                ongoingLabel={t("home.today")}
                passedLabel={t("holiday.passed")}
              />
            </div>
            <dl className="grid gap-6 border-t border-line bg-surface-2/50 p-6 text-sm sm:grid-cols-2 sm:p-10">
              <div>
                <dt className="font-semibold">{t("holiday.officialSource")}</dt>
                <dd className="mt-2">
                  <SourceLink href={occ.sourceUrl} />
                </dd>
                {occ.decisionRefs?.length ? (
                  <>
                    <dt className="mt-5 font-semibold">{t("holiday.decisions")}</dt>
                    <dd className="mt-2">
                      <ul className="space-y-1.5">
                        {occ.decisionRefs.map((d) => (
                          <li key={d.ref} className="flex items-center gap-2">
                            <ScrollText className="size-4 text-muted" aria-hidden="true" />
                            <span className="font-medium tabular-nums">
                              {d.url ? <a href={d.url}>{d.ref}</a> : d.ref}
                            </span>
                            {d.scope ? (
                              <span className="text-muted">· {t(`holiday.scope.${d.scope}`)}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </>
                ) : null}
              </div>
              <div>
                <dt className="font-semibold">{t("holiday.dateSource")}</dt>
                <dd className="mt-2 text-muted">
                  {occ.dateSource.kind === "habous-announcement" ? (
                    <>
                      {t("holiday.announcement", {
                        date: formatDate(occ.dateSource.announcedAt.slice(0, 10), locale),
                      })}
                      <div className="mt-2">
                        <SourceLink href={occ.dateSource.url} />
                      </div>
                    </>
                  ) : occ.status === "estimated" ? (
                    <>
                      {t("holiday.estimateNote")}{" "}
                      <Link href="/sources#religious" className="text-brand underline">
                        {t("nav.sources")}
                      </Link>
                    </>
                  ) : (
                    t("status.fixedHelp")
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        </FadeIn>
      ))}

      <FadeIn delay={0.15} className="mt-10 flex flex-wrap items-start gap-10">
        <section aria-labelledby="other-years" className="me-auto">
          <h2 id="other-years" className="mb-3 font-semibold">
            {t("holiday.otherYears")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {yearsWithHoliday(slug).map((y) => (
              <li key={y}>
                <Link
                  href={`/${y}/${slug}`}
                  aria-current={y === year ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border border-line px-3.5 text-sm tabular-nums hover:border-ink/40",
                    y === year && "border-brand bg-brand text-brand-ink",
                  )}
                >
                  {y}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <SubscribeMenu
          variant="outline"
          feed={feedLinks(def.calendar, locale)}
          calendarLabel={t(`calendars.${def.calendar}`)}
        />
      </FadeIn>
    </article>
  );
}

function SourceLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1.5 break-all text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
    >
      {new URL(href).hostname.replace(/^www\./, "")}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}
