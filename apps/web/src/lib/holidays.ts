import {
  type Core,
  defaultCore,
  type HolidayDefinition,
  type HolidayOccurrence,
  SUPPORTED_YEARS,
} from "@3otla/core";
import { dataset } from "@3otla/data";

export const HOLIDAY_IDS = dataset.holidays.map((h) => h.id);

export function definition(id: string): HolidayDefinition | undefined {
  return dataset.holidays.find((h) => h.id === id);
}

/** Occurrences of a holiday that start in `year` (two for some Hijri holidays, zero before validFrom). */
export function occurrencesStartingIn(
  year: number,
  id: string,
  core: Core = defaultCore,
): HolidayOccurrence[] {
  return core.resolveHolidays(year).filter((o) => o.id === id && o.date.startsWith(`${year}-`));
}

/** Holidays that start in `year`, sorted by date. */
export function holidaysStartingIn(year: number, core: Core = defaultCore): HolidayOccurrence[] {
  return core.resolveHolidays(year).filter((o) => o.date.startsWith(`${year}-`));
}

export function yearsWithHoliday(id: string, core: Core = defaultCore): number[] {
  const years: number[] = [];
  for (let y = SUPPORTED_YEARS.min; y <= SUPPORTED_YEARS.max; y++) {
    if (occurrencesStartingIn(y, id, core).length > 0) years.push(y);
  }
  return years;
}
