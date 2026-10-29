import { describe, expect, it } from "vitest";
import {
  dayOfWeek,
  nextHolidays,
  startOfDayInCasablanca,
  todayInCasablanca,
  workdays,
} from "../src/index";

describe("workdays", () => {
  it("counts a week with Green March (Friday Nov 6, 2026)", () => {
    expect(workdays("2026-11-02", "2026-11-08")).toMatchObject({
      totalDays: 7,
      weekendDays: 2,
      holidayDays: 1,
      workdays: 4,
    });
  });

  it("does not double count holidays on weekends (January 2026)", () => {
    // Jan 1 (Thu) and Jan 14 (Wed) are weekdays; Jan 11 is a Sunday.
    const res = workdays("2026-01-01", "2026-01-31");
    expect(res).toMatchObject({ totalDays: 31, weekendDays: 9, holidayDays: 2, workdays: 20 });
    expect(res.holidays.map((h) => h.id)).toEqual([
      "new-year",
      "independence-manifesto",
      "amazigh-new-year",
    ]);
  });

  it("counts Eid al-Adha 2027 (Sun 16 – Mon 17 May): only Monday is an extra day off", () => {
    const res = workdays("2027-05-10", "2027-05-21");
    expect(res).toMatchObject({ totalDays: 12, weekendDays: 2, holidayDays: 1, workdays: 9 });
  });

  it("handles a single day and rejects reversed or huge ranges", () => {
    expect(workdays("2026-11-18", "2026-11-18")).toMatchObject({ totalDays: 1, workdays: 0 });
    expect(() => workdays("2026-02-01", "2026-01-01")).toThrow(/on or before/);
    expect(() => workdays("2024-01-01", "2035-12-31")).toThrow(/shorter than/);
  });

  it("can restrict to one calendar", () => {
    expect(workdays("2027-05-10", "2027-05-21", ["national"]).holidayDays).toBe(0);
  });
});

describe("nextHolidays", () => {
  it("lists upcoming holidays from the launch date", () => {
    expect(nextHolidays("2026-10-29", 4).map((o) => [o.id, o.date])).toEqual([
      ["unity-day", "2026-10-31"],
      ["green-march", "2026-11-06"],
      ["independence-day", "2026-11-18"],
      ["new-year", "2027-01-01"],
    ]);
  });

  it("includes a holiday in progress", () => {
    expect(nextHolidays("2027-05-17", 1)[0]?.key).toBe("eid-al-adha:1448");
  });

  it("validates count", () => {
    expect(() => nextHolidays("2026-10-29", 0)).toThrow(/count/);
    expect(() => nextHolidays("2026-10-29", 51)).toThrow(/count/);
  });
});

describe("dates", () => {
  it("knows weekdays", () => {
    expect(dayOfWeek("2026-10-31")).toBe(6);
    expect(dayOfWeek("2026-11-01")).toBe(0);
  });

  it("uses Morocco's date, not UTC's", () => {
    // Offsets come from the runtime's tzdata. In July 2026 Casablanca is UTC+1, so
    // 23:30 UTC on Jul 1 is already Jul 2 there.
    expect(todayInCasablanca(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(todayInCasablanca(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-01");
  });

  it("finds the instant a day starts in Morocco", () => {
    expect(startOfDayInCasablanca("2026-07-02").toISOString()).toBe("2026-07-01T23:00:00.000Z");
    for (const d of ["2026-01-01", "2026-03-20", "2026-10-31", "2027-05-16"]) {
      expect(todayInCasablanca(startOfDayInCasablanca(d)), d).toBe(d);
      expect(todayInCasablanca(new Date(startOfDayInCasablanca(d).getTime() - 1)), d).not.toBe(d);
    }
  });
});
