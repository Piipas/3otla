export type HolidayErrorCode =
  | "invalid_date"
  | "invalid_range"
  | "year_out_of_range"
  | "unknown_calendar"
  | "invalid_count";

/** Thrown for invalid input. `code` is stable and maps 1:1 to API error codes. */
export class HolidayError extends Error {
  override readonly name = "HolidayError";
  constructor(
    readonly code: HolidayErrorCode,
    message: string,
  ) {
    super(message);
  }
}
