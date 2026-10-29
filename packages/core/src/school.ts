/**
 * School calendars (public schools, French AEFE schools).
 *
 * School breaks are NOT public holidays: they never affect isHoliday() or workdays().
 * Most breaks are fixed date ranges from the official decision. Breaks tied to a religious
 * holiday (e.g. 29 Ramadan – 2 Shawwal) are Umm al-Qura estimates that move with the
 * holiday's official confirmation.
 */
import type {
  Confirmation,
  Dataset,
  DecisionRef,
  Labels,
  SchoolBreakDefinition,
  SchoolCalendarFile,
} from "@3otla/data";
import { addDays, diffDays, type IsoDate, parseIsoDate, todayInCasablanca } from "./date";
import { HolidayError } from "./errors";
import { hijriToGregorian } from "./hijri";
import { buildIcs, type IcsBuildOptions } from "./ics";
import { MAX_NEXT_COUNT } from "./resolve";
import { type DateSource, SCHOOL_CALENDARS, type SchoolCalendarId, type Status } from "./types";

export interface SchoolBreak {
  /** "school-public:2026-2027:mid-year-break" — stable across date confirmations. */
  key: string;
  id: string;
  calendar: SchoolCalendarId;
  schoolYear: string;
  labels: Labels;
  /** First day without classes. */
  date: IsoDate;
  /** Last day without classes (inclusive). */
  endDate: IsoDate;
  durationDays: number;
  status: Status;
  confirmedAt?: string;
  /** Hijri bounds, for breaks tied to a religious holiday. */
  hijri?: {
    year: number;
    from: { month: number; day: number };
    to: { month: number; day: number };
  };
  /** Official text the calendar comes from. */
  sourceUrl: string;
  decisionRefs?: readonly DecisionRef[];
  dateSource: DateSource;
}

export interface SchoolYear {
  calendar: SchoolCalendarId;
  schoolYear: string;
  sourceUrl: string;
  decisionRefs?: readonly DecisionRef[];
  issuedAt: IsoDate;
  classesStart: IsoDate;
  classesEnd: IsoDate;
  classesEndExceptions: readonly { labels: Labels; date: IsoDate }[];
  breaks: SchoolBreak[];
}

export interface IsSchoolBreakResult {
  date: IsoDate;
  calendar: SchoolCalendarId;
  inBreak: boolean;
  breaks: SchoolBreak[];
}

export interface SchoolCalendars {
  /** School years available for a calendar, oldest first ("2026-2027"). */
  schoolYears(calendar: string): string[];
  /** A school year; defaults to the current one in Morocco. */
  schoolYear(calendar: string, schoolYear?: string, today?: IsoDate): SchoolYear;
  isSchoolBreak(date: string, calendar: string): IsSchoolBreakResult;
  /** Breaks ending on or after `from` (a break in progress is included). */
  nextSchoolBreaks(from: string, calendar: string, count: number): SchoolBreak[];
  generateSchoolIcs(calendar: string, options: IcsBuildOptions): string;
}

const isHijriBreak = (
  b: SchoolBreakDefinition,
): b is Extract<SchoolBreakDefinition, { hijri: unknown }> => "hijri" in b;

export function createSchoolCalendars(dataset: Dataset): SchoolCalendars {
  const files = [...(dataset.schoolCalendars ?? [])].sort((a, b) =>
    a.schoolYear.localeCompare(b.schoolYear),
  );
  const confirmations = new Map<string, Confirmation>(
    dataset.confirmations.map((c) => [`${c.holidayId}:${c.hijriYear}`, c]),
  );
  const holidays = new Map(dataset.holidays.map((h) => [h.id, h]));
  const cache = new Map<string, SchoolYear>();

  function assertCalendar(calendar: string): asserts calendar is SchoolCalendarId {
    if (!(SCHOOL_CALENDARS as readonly string[]).includes(calendar)) {
      throw new HolidayError(
        "unknown_calendar",
        `Unknown school calendar "${calendar}". Expected one of: ${SCHOOL_CALENDARS.join(", ")}`,
      );
    }
  }

  function resolveBreak(file: SchoolCalendarFile, def: SchoolBreakDefinition): SchoolBreak | null {
    const base = {
      key: `${file.calendar}:${file.schoolYear}:${def.id}`,
      id: def.id,
      calendar: file.calendar,
      schoolYear: file.schoolYear,
      labels: def.labels,
      sourceUrl: file.sourceUrl,
      ...(file.decisionRefs ? { decisionRefs: file.decisionRefs } : {}),
    };
    if (!isHijriBreak(def)) {
      return {
        ...base,
        date: def.start,
        endDate: def.end,
        durationDays: diffDays(def.start, def.end) + 1,
        status: "fixed",
        dateSource: { kind: "rule" },
      };
    }

    const { anchor, year, from, to } = def.hijri;
    let start = hijriToGregorian({ year, ...from });
    let end = hijriToGregorian({ year, ...to });
    if (!start || !end) return null;
    const hijri = { year, from, to };

    // When the anchor holiday is officially announced, move the whole break by the
    // difference between the announced date and the Umm al-Qura estimate.
    const anchorDef = holidays.get(anchor);
    const confirmation = confirmations.get(`${anchor}:${year}`);
    const anchorEstimate =
      anchorDef && hijriToGregorian({ year, month: anchorDef.month, day: anchorDef.day });
    if (confirmation && anchorEstimate) {
      const shift = diffDays(anchorEstimate, confirmation.date);
      start = addDays(start, shift);
      end = addDays(end, shift);
      return {
        ...base,
        date: start,
        endDate: end,
        durationDays: diffDays(start, end) + 1,
        status: "confirmed",
        confirmedAt: confirmation.announcedAt,
        hijri,
        dateSource: {
          kind: "habous-announcement",
          url: confirmation.sourceUrl,
          announcedAt: confirmation.announcedAt,
        },
      };
    }
    return {
      ...base,
      date: start,
      endDate: end,
      durationDays: diffDays(start, end) + 1,
      status: "estimated",
      hijri,
      dateSource: { kind: "umm-al-qura-estimate", note: "may-differ-by-1-day" },
    };
  }

  function load(file: SchoolCalendarFile): SchoolYear {
    const key = `${file.calendar}:${file.schoolYear}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const breaks = file.breaks
      .map((b) => resolveBreak(file, b))
      .filter((b): b is SchoolBreak => b !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const year: SchoolYear = {
      calendar: file.calendar,
      schoolYear: file.schoolYear,
      sourceUrl: file.sourceUrl,
      ...(file.decisionRefs ? { decisionRefs: file.decisionRefs } : {}),
      issuedAt: file.issuedAt,
      classesStart: file.classesStart,
      classesEnd: file.classesEnd,
      classesEndExceptions: file.classesEndExceptions ?? [],
      breaks,
    };
    cache.set(key, year);
    return year;
  }

  const filesFor = (calendar: SchoolCalendarId) => files.filter((f) => f.calendar === calendar);

  const schoolYears: SchoolCalendars["schoolYears"] = (calendar) => {
    assertCalendar(calendar);
    return filesFor(calendar).map((f) => f.schoolYear);
  };

  const schoolYear: SchoolCalendars["schoolYear"] = (calendar, wanted, today) => {
    assertCalendar(calendar);
    const available = filesFor(calendar);
    if (wanted !== undefined) {
      const file = available.find((f) => f.schoolYear === wanted);
      if (!file) {
        throw new HolidayError(
          "unknown_school_year",
          `No ${calendar} calendar for ${wanted}. Available: ${available.map((f) => f.schoolYear).join(", ") || "none"}`,
        );
      }
      return load(file);
    }
    // Current = first year whose classes have not ended yet; in summer that is the next
    // year once published, otherwise the latest one.
    const day = today ?? todayInCasablanca();
    const file = available.find((f) => f.classesEnd >= day) ?? available.at(-1);
    if (!file) {
      throw new HolidayError("unknown_school_year", `No ${calendar} calendar published yet`);
    }
    return load(file);
  };

  const allBreaks = (calendar: SchoolCalendarId) =>
    filesFor(calendar).flatMap((f) => load(f).breaks);

  const isSchoolBreak: SchoolCalendars["isSchoolBreak"] = (input, calendar) => {
    const date = parseIsoDate(input);
    assertCalendar(calendar);
    const breaks = allBreaks(calendar).filter((b) => b.date <= date && b.endDate >= date);
    return { date, calendar, inBreak: breaks.length > 0, breaks };
  };

  const nextSchoolBreaks: SchoolCalendars["nextSchoolBreaks"] = (input, calendar, count) => {
    const from = parseIsoDate(input);
    assertCalendar(calendar);
    if (!Number.isInteger(count) || count < 1 || count > MAX_NEXT_COUNT) {
      throw new HolidayError(
        "invalid_count",
        `count must be an integer from 1 to ${MAX_NEXT_COUNT}`,
      );
    }
    return allBreaks(calendar)
      .filter((b) => b.endDate >= from)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, count);
  };

  const generateSchoolIcs: SchoolCalendars["generateSchoolIcs"] = (calendar, options) => {
    assertCalendar(calendar);
    const items = allBreaks(calendar).map((b) => ({ ...b, path: `/school#${b.calendar}` }));
    return buildIcs(calendar, items, options);
  };

  return { schoolYears, schoolYear, isSchoolBreak, nextSchoolBreaks, generateSchoolIcs };
}
