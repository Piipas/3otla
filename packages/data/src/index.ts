import confirmationsFile from "../confirmations.json" with { type: "json" };
import nationalFile from "../holidays/national.json" with { type: "json" };
import religiousFile from "../holidays/religious.json" with { type: "json" };
import type { Confirmation, Dataset, HolidayDefinition } from "./types";

export * from "./types";

// JSON imports are widened (e.g. `type: string`). The files are validated against
// schema/*.schema.json in CI, which is what makes these casts safe.
export const nationalHolidays = nationalFile.holidays as HolidayDefinition[];
export const religiousHolidays = religiousFile.holidays as HolidayDefinition[];
export const confirmations = confirmationsFile.confirmations as Confirmation[];

export const dataset: Dataset = {
  holidays: [...nationalHolidays, ...religiousHolidays],
  confirmations,
};
