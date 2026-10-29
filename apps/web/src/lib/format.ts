import { HIJRI_MONTHS, type HijriDate, type HolidayOccurrence, type IsoDate } from "@3otla/core";
import { type AppLocale, INTL_LOCALE } from "@/i18n/routing";

const LONG: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
};

// Dates are calendar dates; formatting them at UTC midnight in UTC never shifts the day.
const asDate = (date: IsoDate) => new Date(`${date}T00:00:00Z`);

export function formatDate(
  date: IsoDate,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = LONG,
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: "UTC" }).format(
    asDate(date),
  );
}

/** "dimanche 16 mai 2027" or "16 – 17 mai 2027" for multi-day holidays. */
export function formatOccurrenceDates(occ: HolidayOccurrence, locale: AppLocale): string {
  if (occ.date === occ.endDate) return formatDate(occ.date, locale);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatRange(asDate(occ.date), asDate(occ.endDate));
}

export function formatHijri(h: HijriDate, locale: AppLocale): string {
  const month = HIJRI_MONTHS[h.month - 1]?.[locale] ?? String(h.month);
  const suffix = locale === "ar" ? "هـ" : "H";
  return `${h.day} ${month} ${h.year} ${suffix}`;
}

export function monthName(month: number, locale: AppLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, month - 1, 1)),
  );
}

/** Monday-first short weekday names (Morocco's week starts on Monday). */
export function weekdayNames(locale: AppLocale): string[] {
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short", timeZone: "UTC" });
  // 2026-01-05 is a Monday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2026, 0, 5 + i))));
}
