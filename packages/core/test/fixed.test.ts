import { describe, expect, it } from "vitest";
import { HolidayError, isHoliday, resolveHolidays, SUPPORTED_YEARS } from "../src/index";

const NATIONAL_2026 = [
  ["new-year", "2026-01-01"],
  ["independence-manifesto", "2026-01-11"],
  ["amazigh-new-year", "2026-01-14"],
  ["labour-day", "2026-05-01"],
  ["throne-day", "2026-07-30"],
  ["oued-ed-dahab", "2026-08-14"],
  ["revolution-of-the-king-and-the-people", "2026-08-20"],
  ["youth-day", "2026-08-21"],
  ["unity-day", "2026-10-31"],
  ["green-march", "2026-11-06"],
  ["independence-day", "2026-11-18"],
];

describe("fixed national holidays", () => {
  it("resolves all 2026 national holidays", () => {
    const got = resolveHolidays(2026, ["national"]).map((o) => [o.id, o.date]);
    expect(got).toEqual(NATIONAL_2026);
  });

  it("marks them fixed, with a rule date source and an official sourceUrl", () => {
    for (const o of resolveHolidays(2026, ["national"])) {
      expect(o.status).toBe("fixed");
      expect(o.dateSource).toEqual({ kind: "rule" });
      expect(o.sourceUrl).toMatch(/^https:\/\/www\.maroc\.ma\//);
      expect(o.endDate).toBe(o.date);
      expect(o.key).toBe(`${o.id}:2026`);
    }
  });

  it("Unity Day (Oct 31) is absent before 2026", () => {
    expect(resolveHolidays(2025, ["national"]).some((o) => o.id === "unity-day")).toBe(false);
    expect(isHoliday("2025-10-31").isHoliday).toBe(false);
  });

  it("Unity Day is present from 2026 with both decree refs", () => {
    const res = isHoliday("2026-10-31");
    expect(res.isHoliday).toBe(true);
    expect(res.isWeekend).toBe(true); // Saturday
    const [unity] = res.holidays;
    expect(unity?.id).toBe("unity-day");
    expect(unity?.decisionRefs?.map((d) => d.ref)).toEqual(["2.25.1140", "2.26.14"]);
    expect(isHoliday("2030-10-31").isHoliday).toBe(true);
  });

  it("returns an ordinary day as not a holiday", () => {
    expect(isHoliday("2026-10-29")).toEqual({
      date: "2026-10-29",
      isHoliday: false,
      isWeekend: false,
      holidays: [],
    });
  });
});

describe("input validation", () => {
  it("rejects years outside the supported range", () => {
    const err = (() => {
      try {
        resolveHolidays(SUPPORTED_YEARS.min - 1);
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(HolidayError);
    expect((err as HolidayError).code).toBe("year_out_of_range");
    expect(() => resolveHolidays(SUPPORTED_YEARS.max + 1)).toThrow(HolidayError);
    expect(() => resolveHolidays(2026.5)).toThrow(HolidayError);
  });

  it("rejects malformed and impossible dates", () => {
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "26-01-01",
      "2026-1-1",
      "",
      "2026-01-01T00:00",
    ]) {
      expect(() => isHoliday(bad), bad).toThrow(/not a valid/);
    }
  });

  it("rejects unknown calendars", () => {
    expect(() => resolveHolidays(2026, ["school-public"])).toThrow(/Unknown calendar/);
  });
});
