/** Shapes of the JSON files in this package. Kept in sync with schema/*.schema.json. */

export type Locale = "ar" | "fr" | "en";
export const LOCALES: readonly Locale[] = ["ar", "fr", "en"];

export type CalendarId = "national" | "religious";
export const CALENDARS: readonly CalendarId[] = ["national", "religious"];

export type Labels = Record<Locale, string>;

export interface DecisionRef {
  ref: string;
  kind?: "decree" | "royal-decision" | "ministerial-decision";
  scope?: "all" | "public-sector" | "private-sector";
  url?: string;
}

interface HolidayDefinitionBase {
  id: string;
  calendar: CalendarId;
  durationDays: number;
  labels: Labels;
  sourceUrl: string;
  decisionRefs?: DecisionRef[];
  validFrom: string;
  validTo?: string;
}

/** Same Gregorian month/day every year. */
export interface FixedHolidayDefinition extends HolidayDefinitionBase {
  type: "fixed";
  month: number;
  day: number;
}

/** Hijri month/day; the Gregorian date is estimated (Umm al-Qura) until confirmed. */
export interface HijriHolidayDefinition extends HolidayDefinitionBase {
  type: "hijri";
  month: number;
  day: number;
}

export type HolidayDefinition = FixedHolidayDefinition | HijriHolidayDefinition;

/** An official announcement (Ministry of Habous) fixing a Hijri holiday's Gregorian date. */
export interface Confirmation {
  holidayId: string;
  hijriYear: number;
  date: string;
  announcedAt: string;
  sourceUrl: string;
  durationDays?: number;
  note?: string;
}

/** School calendars. These are not public holidays and never count as days off for workers. */
export type SchoolCalendarId = "school-public";
export const SCHOOL_CALENDARS: readonly SchoolCalendarId[] = ["school-public"];

/** Inclusive range of days without classes. */
export interface FixedSchoolBreak {
  id: string;
  labels: Labels;
  start: string;
  end: string;
  sourceText?: string;
}

/** Break defined in Hijri days around a religious holiday (e.g. 29 Ramadan – 2 Shawwal). */
export interface HijriSchoolBreak {
  id: string;
  labels: Labels;
  hijri: {
    /** Religious holiday whose confirmation shifts this break. */
    anchor: string;
    year: number;
    from: { month: number; day: number };
    to: { month: number; day: number };
  };
  sourceText?: string;
}

export type SchoolBreakDefinition = FixedSchoolBreak | HijriSchoolBreak;

export interface SchoolCalendarFile {
  calendar: SchoolCalendarId;
  /** "2026-2027" */
  schoolYear: string;
  sourceUrl: string;
  decisionRefs?: DecisionRef[];
  issuedAt: string;
  classesStart: string;
  classesEnd: string;
  classesEndExceptions?: { labels: Labels; date: string }[];
  breaks: SchoolBreakDefinition[];
}

export interface Dataset {
  holidays: readonly HolidayDefinition[];
  confirmations: readonly Confirmation[];
  schoolCalendars?: readonly SchoolCalendarFile[];
}
