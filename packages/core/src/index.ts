import { dataset } from "@3otla/data";
import { type IsoDate, parseIsoDate } from "./date";
import { gregorianToHijri, HIJRI_MONTHS, type HijriDate, hijriToGregorian } from "./hijri";
import { createResolver } from "./resolve";
import { createSchoolCalendars } from "./school";
import type { Labels } from "./types";

export {
  addDays,
  dayOfWeek,
  diffDays,
  type IsoDate,
  isWeekend,
  parseIsoDate,
  startOfDayInCasablanca,
  TIME_ZONE,
  todayInCasablanca,
} from "./date";
export { HolidayError, type HolidayErrorCode } from "./errors";
export { HIJRI_MONTHS, type HijriDate } from "./hijri";
export type { FeedId, IcsBuildOptions, IcsItem, IcsOptions } from "./ics";
export {
  createResolver,
  MAX_NEXT_COUNT,
  MAX_WORKDAYS_SPAN,
  type Resolver,
  type ResolverOptions,
  SUPPORTED_YEARS,
} from "./resolve";
export {
  createSchoolCalendars,
  type IsSchoolBreakResult,
  type SchoolBreak,
  type SchoolCalendars,
  type SchoolYear,
} from "./school";
export * from "./types";

/** Resolver bound to the official dataset in @3otla/data. */
export const defaultResolver = createResolver(dataset);
export const { resolveHolidays, isHoliday, nextHolidays, workdays, generateIcs } = defaultResolver;

/** School calendars bound to the official dataset. School breaks are not public holidays. */
export const defaultSchoolCalendars = createSchoolCalendars(dataset);
export const { schoolYears, schoolYear, isSchoolBreak, nextSchoolBreaks, generateSchoolIcs } =
  defaultSchoolCalendars;

export interface HijriInfo extends HijriDate {
  monthName: Labels;
  method: "umm-al-qura";
  /** Always true: Morocco's calendar follows local moon sighting and may differ by a day. */
  estimated: true;
}

/** Umm al-Qura Hijri date for a Gregorian "YYYY-MM-DD". */
export function toHijri(date: string): HijriInfo {
  const h = gregorianToHijri(parseIsoDate(date));
  return {
    ...h,
    monthName: HIJRI_MONTHS[h.month - 1] as Labels,
    method: "umm-al-qura",
    estimated: true,
  };
}

/** Gregorian date of a Umm al-Qura Hijri date, or null if the day does not exist. */
export function fromHijri(hijri: HijriDate): IsoDate | null {
  return hijriToGregorian(hijri);
}
