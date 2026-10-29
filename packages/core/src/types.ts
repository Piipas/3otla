import type { CalendarId, DecisionRef, Labels } from "@3otla/data";
import type { IsoDate } from "./date";
import type { HijriDate } from "./hijri";

export type {
  CalendarId,
  Confirmation,
  Dataset,
  DecisionRef,
  HolidayDefinition,
  Labels,
  Locale,
} from "@3otla/data";
export { CALENDARS, LOCALES } from "@3otla/data";

/**
 * - fixed: Gregorian rule, the date is certain.
 * - estimated: Hijri rule computed with Umm al-Qura; Morocco may differ by a day.
 * - confirmed: announced officially (Ministry of Habous), see `dateSource`.
 */
export type Status = "fixed" | "estimated" | "confirmed";

/** Why the holiday falls on this date (distinct from why it is a holiday: `sourceUrl`). */
export type DateSource =
  | { kind: "rule" }
  | { kind: "umm-al-qura-estimate"; note: "may-differ-by-1-day" }
  | { kind: "habous-announcement"; url: string; announcedAt: string };

/** One concrete occurrence of a holiday. */
export interface HolidayOccurrence {
  /** Unique per occurrence and stable when the date changes: "eid-al-adha:1448", "green-march:2026". */
  key: string;
  /** Holiday id, also used as the URL slug. */
  id: string;
  calendar: CalendarId;
  type: "fixed" | "hijri";
  labels: Labels;
  /** First day off. */
  date: IsoDate;
  /** Last day off, inclusive. */
  endDate: IsoDate;
  durationDays: number;
  status: Status;
  /** ISO date-time of the official announcement, when status is "confirmed". */
  confirmedAt?: string;
  /** Hijri date of the first day, for Hijri holidays. */
  hijri?: HijriDate;
  /** Official source establishing the holiday itself. */
  sourceUrl: string;
  decisionRefs?: readonly DecisionRef[];
  dateSource: DateSource;
}

export interface IsHolidayResult {
  date: IsoDate;
  isHoliday: boolean;
  isWeekend: boolean;
  holidays: HolidayOccurrence[];
}

export interface WorkdaysResult {
  from: IsoDate;
  to: IsoDate;
  /** Days in the inclusive range. */
  totalDays: number;
  workdays: number;
  weekendDays: number;
  /** Holiday days falling on weekdays (weekend holidays are counted as weekend days). */
  holidayDays: number;
  /** Holidays overlapping the range. */
  holidays: HolidayOccurrence[];
}
