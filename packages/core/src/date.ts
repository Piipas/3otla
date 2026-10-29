/**
 * Calendar-date arithmetic on "YYYY-MM-DD" strings.
 *
 * Dates never carry a time of day: they are converted to a day number (days since
 * 1970-01-01, computed at UTC midnight) so DST and Morocco's Ramadan clock changes
 * can never shift a date. Only "what day is it now?" depends on a time zone.
 */
import { HolidayError } from "./errors";

/** A calendar date, "YYYY-MM-DD". Produce with `parseIsoDate` when the input is untrusted. */
export type IsoDate = string;

export const TIME_ZONE = "Africa/Casablanca";

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function isoFromParts(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Returns [year, month, day] of a date already known to be well formed. */
export function isoParts(date: IsoDate): [number, number, number] {
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
}

export function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Validates "YYYY-MM-DD" (including real month lengths). Throws `invalid_date`. */
export function parseIsoDate(input: string): IsoDate {
  const m = ISO_RE.exec(input);
  if (!m || !isValidDate(Number(m[1]), Number(m[2]), Number(m[3]))) {
    throw new HolidayError("invalid_date", `"${input}" is not a valid YYYY-MM-DD date`);
  }
  return input;
}

export function toDayNumber(date: IsoDate): number {
  const [y, m, d] = isoParts(date);
  const utc = new Date(0);
  // setUTCFullYear avoids Date.UTC's 0–99 → 1900s mapping.
  utc.setUTCFullYear(y, m - 1, d);
  return Math.round(utc.getTime() / MS_PER_DAY);
}

export function fromDayNumber(dayNumber: number): IsoDate {
  const d = new Date(dayNumber * MS_PER_DAY);
  return isoFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return toDayNumber(b) - toDayNumber(a);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
  // 1970-01-01 was a Thursday (4).
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/** Morocco's weekend: Saturday and Sunday. */
export function isWeekend(date: IsoDate): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

const casablancaFormat = new Intl.DateTimeFormat("en-u-ca-gregory-nu-latn", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** Today's date in Morocco. */
export function todayInCasablanca(now: Date = new Date()): IsoDate {
  const parts = Object.fromEntries(
    casablancaFormat.formatToParts(now).map((p) => [p.type, p.value]),
  );
  return isoFromParts(Number(parts.year), Number(parts.month), Number(parts.day));
}
