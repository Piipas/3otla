import confirmationsFile from "../confirmations.json" with { type: "json" };
import nationalFile from "../holidays/national.json" with { type: "json" };
import religiousFile from "../holidays/religious.json" with { type: "json" };
import aefe20262027 from "../school/school-aefe/2026-2027.json" with { type: "json" };
import public20262027 from "../school/school-public/2026-2027.json" with { type: "json" };
import type { Confirmation, Dataset, HolidayDefinition, SchoolCalendarFile } from "./types";

export * from "./types";

// JSON imports are widened (e.g. `type: string`). The files are validated against
// schema/*.schema.json in CI, which is what makes these casts safe.
export const nationalHolidays = nationalFile.holidays as HolidayDefinition[];
export const religiousHolidays = religiousFile.holidays as HolidayDefinition[];
export const confirmations = confirmationsFile.confirmations as Confirmation[];

/** One file per calendar per school year. Add new years here. */
export const schoolCalendars = [public20262027, aefe20262027] as unknown as SchoolCalendarFile[];

export const dataset: Dataset = {
  holidays: [...nationalHolidays, ...religiousHolidays],
  confirmations,
  schoolCalendars,
};
