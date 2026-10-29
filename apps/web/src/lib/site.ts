import { type CalendarId, SUPPORTED_YEARS, todayInCasablanca } from "@3otla/core";
import { type AppLocale, routing } from "@/i18n/routing";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

/** Public repository, shown in the footer and sources page when set. */
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

export function currentYear(now: Date = new Date()): number {
  return Number(todayInCasablanca(now).slice(0, 4));
}

/** Years pre-rendered at build time; other supported years render on first request. */
export function staticYears(): number[] {
  const y = currentYear();
  return [y - 1, y, y + 1, y + 2].filter(
    (v) => v >= SUPPORTED_YEARS.min && v <= SUPPORTED_YEARS.max,
  );
}

export function parseYear(param: string): number | null {
  if (!/^\d{4}$/.test(param)) return null;
  const year = Number(param);
  return year >= SUPPORTED_YEARS.min && year <= SUPPORTED_YEARS.max ? year : null;
}

/** Canonical URL and hreflang alternates for a path (without locale prefix, e.g. "/2027"). */
export function alternates(locale: AppLocale, path: string) {
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
  ) as Record<string, string>;
  languages["x-default"] = `${SITE_URL}/${routing.defaultLocale}${path}`;
  return { canonical: `${SITE_URL}/${locale}${path}`, languages };
}

export type FeedCalendar = CalendarId | "all";

export function icsUrl(calendar: FeedCalendar, locale: AppLocale): string {
  return `${SITE_URL}/api/v1/calendars/${calendar}.ics?lang=${locale}`;
}

export function webcalUrl(calendar: FeedCalendar, locale: AppLocale): string {
  return icsUrl(calendar, locale).replace(/^https?:/, "webcal:");
}

export function googleCalendarUrl(calendar: FeedCalendar, locale: AppLocale): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl(calendar, locale))}`;
}

export function feedLinks(calendar: FeedCalendar, locale: AppLocale) {
  return {
    google: googleCalendarUrl(calendar, locale),
    webcal: webcalUrl(calendar, locale),
    ics: icsUrl(calendar, locale),
  };
}
