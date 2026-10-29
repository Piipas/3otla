import type { Confirmation, Dataset, HolidayDefinition } from "@3otla/data";
import {
  addDays,
  diffDays,
  type IsoDate,
  isoFromParts,
  isoParts,
  isValidDate,
  isWeekend,
  parseIsoDate,
} from "./date";
import { HolidayError } from "./errors";
import { gregorianToHijri, hijriToGregorian } from "./hijri";
import { buildIcs, type IcsOptions } from "./ics";
import {
  CALENDARS,
  type CalendarId,
  type HolidayOccurrence,
  type IsHolidayResult,
  type WorkdaysResult,
} from "./types";

/** Years the API and site answer for. Data `validFrom` floors are aligned to `min`. */
export const SUPPORTED_YEARS = { min: 2024, max: 2035 } as const;

export const MAX_NEXT_COUNT = 50;
/** Upper bound for `workdays` ranges, to keep requests cheap. */
export const MAX_WORKDAYS_SPAN = 3660;

export interface ResolverOptions {
  supportedYears?: { min: number; max: number };
}

export interface Resolver {
  /** Occurrences overlapping `year` (a holiday starting Dec 31 of year-1 is included), sorted by date. */
  resolveHolidays(year: number, calendars?: readonly string[]): HolidayOccurrence[];
  isHoliday(date: string, calendars?: readonly string[]): IsHolidayResult;
  /** The next `count` holidays ending on or after `from` (a holiday in progress is included). */
  nextHolidays(from: string, count: number, calendars?: readonly string[]): HolidayOccurrence[];
  /** Inclusive range. Weekend is Saturday and Sunday. */
  workdays(from: string, to: string, calendars?: readonly string[]): WorkdaysResult;
  generateIcs(calendar: CalendarId | "all", options: IcsOptions): string;
}

export function createResolver(dataset: Dataset, options: ResolverOptions = {}): Resolver {
  const years = options.supportedYears ?? SUPPORTED_YEARS;
  const confirmationIndex = new Map<string, Confirmation>(
    dataset.confirmations.map((c) => [`${c.holidayId}:${c.hijriYear}`, c]),
  );
  const byYear = new Map<number, readonly HolidayOccurrence[]>();

  function assertYear(year: number): void {
    if (!Number.isInteger(year) || year < years.min || year > years.max) {
      throw new HolidayError(
        "year_out_of_range",
        `Year ${year} is outside the supported range ${years.min}–${years.max}`,
      );
    }
  }

  function selectCalendars(calendars?: readonly string[]): ReadonlySet<CalendarId> {
    if (!calendars || calendars.length === 0) return new Set(CALENDARS);
    for (const c of calendars) {
      if (!(CALENDARS as readonly string[]).includes(c)) {
        throw new HolidayError(
          "unknown_calendar",
          `Unknown calendar "${c}". Expected one of: ${CALENDARS.join(", ")}`,
        );
      }
    }
    return new Set(calendars as readonly CalendarId[]);
  }

  function isValidOn(def: HolidayDefinition, date: IsoDate): boolean {
    return date >= def.validFrom && (def.validTo === undefined || date <= def.validTo);
  }

  function base(def: HolidayDefinition) {
    return {
      id: def.id,
      calendar: def.calendar,
      type: def.type,
      labels: def.labels,
      sourceUrl: def.sourceUrl,
      ...(def.decisionRefs ? { decisionRefs: def.decisionRefs } : {}),
    };
  }

  function fixedOccurrence(
    def: HolidayDefinition,
    gregorianYear: number,
  ): HolidayOccurrence | null {
    if (!isValidDate(gregorianYear, def.month, def.day)) return null;
    const date = isoFromParts(gregorianYear, def.month, def.day);
    return {
      key: `${def.id}:${gregorianYear}`,
      ...base(def),
      date,
      endDate: addDays(date, def.durationDays - 1),
      durationDays: def.durationDays,
      status: "fixed",
      dateSource: { kind: "rule" },
    };
  }

  function hijriOccurrence(def: HolidayDefinition, hijriYear: number): HolidayOccurrence | null {
    const hijri = { year: hijriYear, month: def.month, day: def.day };
    const confirmation = confirmationIndex.get(`${def.id}:${hijriYear}`);
    if (confirmation) {
      const durationDays = confirmation.durationDays ?? def.durationDays;
      return {
        key: `${def.id}:${hijriYear}`,
        ...base(def),
        date: confirmation.date,
        endDate: addDays(confirmation.date, durationDays - 1),
        durationDays,
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
    const date = hijriToGregorian(hijri);
    if (!date) return null;
    return {
      key: `${def.id}:${hijriYear}`,
      ...base(def),
      date,
      endDate: addDays(date, def.durationDays - 1),
      durationDays: def.durationDays,
      status: "estimated",
      hijri,
      dateSource: { kind: "umm-al-qura-estimate", note: "may-differ-by-1-day" },
    };
  }

  function occurrencesOverlapping(year: number): readonly HolidayOccurrence[] {
    const cached = byYear.get(year);
    if (cached) return cached;

    const start = isoFromParts(year, 1, 1);
    const end = isoFromParts(year, 12, 31);
    // A Hijri year is ~11 days shorter than a Gregorian one, so a Gregorian year can
    // contain two occurrences of the same Hijri holiday. Start a week early to catch
    // multi-day holidays that begin in late December of the previous year.
    const firstHijriYear = gregorianToHijri(addDays(start, -7)).year;
    const lastHijriYear = gregorianToHijri(end).year;

    const result: HolidayOccurrence[] = [];
    for (const def of dataset.holidays) {
      const candidates: (HolidayOccurrence | null)[] = [];
      if (def.type === "fixed") {
        candidates.push(fixedOccurrence(def, year - 1), fixedOccurrence(def, year));
      } else {
        for (let hy = firstHijriYear; hy <= lastHijriYear; hy++) {
          candidates.push(hijriOccurrence(def, hy));
        }
      }
      for (const occ of candidates) {
        if (occ && occ.endDate >= start && occ.date <= end && isValidOn(def, occ.date)) {
          result.push(Object.freeze(occ));
        }
      }
    }
    result.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const frozen = Object.freeze(result);
    byYear.set(year, frozen);
    return frozen;
  }

  /** Occurrences overlapping [from, to], deduplicated across year boundaries, sorted. */
  function occurrencesBetween(
    from: IsoDate,
    to: IsoDate,
    calendars: ReadonlySet<CalendarId>,
  ): HolidayOccurrence[] {
    const seen = new Map<string, HolidayOccurrence>();
    for (let y = isoParts(from)[0]; y <= isoParts(to)[0]; y++) {
      for (const occ of occurrencesOverlapping(y)) {
        if (calendars.has(occ.calendar) && occ.endDate >= from && occ.date <= to) {
          seen.set(occ.key, occ);
        }
      }
    }
    return [...seen.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  }

  const resolveHolidays: Resolver["resolveHolidays"] = (year, calendars) => {
    assertYear(year);
    const selected = selectCalendars(calendars);
    return occurrencesOverlapping(year).filter((o) => selected.has(o.calendar));
  };

  const isHoliday: Resolver["isHoliday"] = (input, calendars) => {
    const date = parseIsoDate(input);
    assertYear(isoParts(date)[0]);
    const holidays = occurrencesBetween(date, date, selectCalendars(calendars));
    return { date, isHoliday: holidays.length > 0, isWeekend: isWeekend(date), holidays };
  };

  const nextHolidays: Resolver["nextHolidays"] = (input, count, calendars) => {
    const from = parseIsoDate(input);
    if (!Number.isInteger(count) || count < 1 || count > MAX_NEXT_COUNT) {
      throw new HolidayError(
        "invalid_count",
        `count must be an integer from 1 to ${MAX_NEXT_COUNT}`,
      );
    }
    const fromYear = isoParts(from)[0];
    assertYear(fromYear);
    const selected = selectCalendars(calendars);
    const found = new Map<string, HolidayOccurrence>();
    // After finishing year y, every occurrence starting on or before Dec 31 of y is known,
    // so we can stop as soon as we have enough.
    for (let y = fromYear; y <= years.max && found.size < count; y++) {
      for (const occ of occurrencesOverlapping(y)) {
        if (selected.has(occ.calendar) && occ.endDate >= from) found.set(occ.key, occ);
      }
    }
    return [...found.values()]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      .slice(0, count);
  };

  const workdays: Resolver["workdays"] = (fromInput, toInput, calendars) => {
    const from = parseIsoDate(fromInput);
    const to = parseIsoDate(toInput);
    const span = diffDays(from, to);
    if (span < 0) throw new HolidayError("invalid_range", "`from` must be on or before `to`");
    if (span >= MAX_WORKDAYS_SPAN) {
      throw new HolidayError(
        "invalid_range",
        `Range must be shorter than ${MAX_WORKDAYS_SPAN} days`,
      );
    }
    assertYear(isoParts(from)[0]);
    assertYear(isoParts(to)[0]);

    const holidays = occurrencesBetween(from, to, selectCalendars(calendars));
    const holidayDates = new Set<IsoDate>();
    for (const occ of holidays) {
      for (let i = 0; i < occ.durationDays; i++) holidayDates.add(addDays(occ.date, i));
    }

    let weekendDays = 0;
    let holidayDays = 0;
    for (let i = 0; i <= span; i++) {
      const day = addDays(from, i);
      if (isWeekend(day)) weekendDays++;
      else if (holidayDates.has(day)) holidayDays++;
    }
    const totalDays = span + 1;
    return {
      from,
      to,
      totalDays,
      workdays: totalDays - weekendDays - holidayDays,
      weekendDays,
      holidayDays,
      holidays,
    };
  };

  const generateIcs: Resolver["generateIcs"] = (calendar, icsOptions) => {
    const calendars = calendar === "all" ? undefined : [calendar];
    const selected = selectCalendars(calendars);
    assertYear(icsOptions.fromYear);
    assertYear(icsOptions.toYear);
    const occurrences = occurrencesBetween(
      isoFromParts(icsOptions.fromYear, 1, 1),
      isoFromParts(icsOptions.toYear, 12, 31),
      selected,
    );
    return buildIcs(calendar, occurrences, icsOptions);
  };

  return { resolveHolidays, isHoliday, nextHolidays, workdays, generateIcs };
}
