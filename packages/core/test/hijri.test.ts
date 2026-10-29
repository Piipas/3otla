import { describe, expect, it } from "vitest";
import { addDays, fromHijri, resolveHolidays, SUPPORTED_YEARS, toHijri } from "../src/index";

// Umm al-Qura dates (ICU table), spot-checked against the published Umm al-Qura calendar.
const ESTIMATES: Record<number, [string, number, string][]> = {
  2026: [
    ["eid-al-fitr", 1447, "2026-03-20"],
    ["eid-al-adha", 1447, "2026-05-27"],
    ["islamic-new-year", 1448, "2026-06-16"],
    ["mawlid", 1448, "2026-08-25"],
  ],
  2027: [
    ["eid-al-fitr", 1448, "2027-03-09"],
    ["eid-al-adha", 1448, "2027-05-16"],
    ["islamic-new-year", 1449, "2027-06-06"],
    ["mawlid", 1449, "2027-08-14"],
  ],
  2028: [
    ["eid-al-fitr", 1449, "2028-02-26"],
    ["eid-al-adha", 1449, "2028-05-05"],
    ["islamic-new-year", 1450, "2028-05-25"],
    ["mawlid", 1450, "2028-08-03"],
  ],
};

describe("toHijri / fromHijri", () => {
  it("converts known dates", () => {
    expect(toHijri("2026-05-27")).toMatchObject({ year: 1447, month: 12, day: 10 });
    expect(toHijri("2026-05-27").monthName.ar).toBe("ذو الحجة");
    expect(toHijri("2026-03-20")).toMatchObject({ year: 1447, month: 10, day: 1 });
    expect(toHijri("2026-03-20").estimated).toBe(true);
  });

  it("round-trips every day of the supported range", () => {
    const start = `${SUPPORTED_YEARS.min}-01-01`;
    const end = `${SUPPORTED_YEARS.max}-12-31`;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const { year, month, day } = toHijri(d);
      expect(fromHijri({ year, month, day }), d).toBe(d);
    }
  });

  it("returns null for a day that does not exist", () => {
    // Every Umm al-Qura month has 29 or 30 days; at least one month of 1448 has 29.
    const missing = Array.from({ length: 12 }, (_, i) =>
      fromHijri({ year: 1448, month: i + 1, day: 30 }),
    );
    expect(missing).toContain(null);
  });
});

describe("religious holiday estimates", () => {
  for (const [year, expected] of Object.entries(ESTIMATES)) {
    it(`matches Umm al-Qura for ${year}`, () => {
      const got = resolveHolidays(Number(year), ["religious"]).map((o) => [
        o.id,
        o.hijri?.year,
        o.date,
      ]);
      expect(got).toEqual(expected);
    });
  }

  it("marks estimates and gives multi-day end dates", () => {
    for (const o of resolveHolidays(2027, ["religious"])) {
      expect(o.status).toBe("estimated");
      expect(o.dateSource).toEqual({ kind: "umm-al-qura-estimate", note: "may-differ-by-1-day" });
      expect(o.endDate).toBe(addDays(o.date, o.durationDays - 1));
    }
    const adha = resolveHolidays(2027, ["religious"]).find((o) => o.id === "eid-al-adha");
    expect(adha).toMatchObject({ date: "2027-05-16", endDate: "2027-05-17", durationDays: 2 });
  });

  it("handles two Eid al-Fitr in the same Gregorian year (2033)", () => {
    const fitr = resolveHolidays(2033, ["religious"]).filter((o) => o.id === "eid-al-fitr");
    expect(fitr.map((o) => [o.key, o.date])).toEqual([
      ["eid-al-fitr:1454", "2033-01-03"],
      ["eid-al-fitr:1455", "2033-12-23"],
    ]);
  });

  it("every occurrence overlaps the requested year", () => {
    for (let y = SUPPORTED_YEARS.min; y <= SUPPORTED_YEARS.max; y++) {
      for (const o of resolveHolidays(y)) {
        expect(o.endDate >= `${y}-01-01` && o.date <= `${y}-12-31`, `${y} ${o.key}`).toBe(true);
      }
    }
  });
});
