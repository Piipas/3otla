import { dataset } from "@3otla/data";
import { describe, expect, it } from "vitest";
import { createResolver, diffDays, fromHijri } from "../src/index";

const HABOUS = "https://www.habous.gov.ma/annonce-example";

describe("confirmations", () => {
  const resolver = createResolver({
    holidays: dataset.holidays,
    confirmations: [
      {
        holidayId: "eid-al-adha",
        hijriYear: 1448,
        date: "2027-05-17", // one day after Umm al-Qura (2027-05-16)
        announcedAt: "2027-05-07T19:30:00Z",
        sourceUrl: HABOUS,
      },
      {
        holidayId: "eid-al-fitr",
        hijriYear: 1454,
        date: "2032-12-31", // hypothetical: pulls the occurrence across the year boundary
        announcedAt: "2032-12-30T19:30:00Z",
        sourceUrl: HABOUS,
      },
    ],
  });

  it("overrides the estimate with the announced date", () => {
    const adha = resolver.resolveHolidays(2027).find((o) => o.key === "eid-al-adha:1448");
    expect(adha).toMatchObject({
      date: "2027-05-17",
      endDate: "2027-05-18",
      status: "confirmed",
      confirmedAt: "2027-05-07T19:30:00Z",
      hijri: { year: 1448, month: 12, day: 10 },
      dateSource: {
        kind: "habous-announcement",
        url: HABOUS,
        announcedAt: "2027-05-07T19:30:00Z",
      },
    });
  });

  it("moves isHoliday and workdays accordingly", () => {
    expect(resolver.isHoliday("2027-05-16").isHoliday).toBe(false);
    expect(resolver.isHoliday("2027-05-18").isHoliday).toBe(true);
  });

  it("leaves other years estimated", () => {
    const adha = resolver.resolveHolidays(2028).find((o) => o.id === "eid-al-adha");
    expect(adha?.status).toBe("estimated");
  });

  it("includes a holiday spanning Dec 31 in both years, once per range", () => {
    const in2032 = resolver.resolveHolidays(2032).filter((o) => o.key === "eid-al-fitr:1454");
    const in2033 = resolver.resolveHolidays(2033).filter((o) => o.key === "eid-al-fitr:1454");
    expect(in2032).toHaveLength(1);
    expect(in2033).toHaveLength(1);
    expect(in2033[0]).toMatchObject({ date: "2032-12-31", endDate: "2033-01-01" });

    const range = resolver.workdays("2032-12-27", "2033-01-07");
    expect(range.holidays.filter((o) => o.key === "eid-al-fitr:1454")).toHaveLength(1);
  });
});

describe("official confirmations.json", () => {
  it("each confirmation is within ±2 days of its Umm al-Qura estimate", () => {
    const byId = new Map(dataset.holidays.map((h) => [h.id, h]));
    for (const c of dataset.confirmations) {
      const def = byId.get(c.holidayId);
      expect(def?.type, c.holidayId).toBe("hijri");
      if (!def) continue;
      const estimate = fromHijri({ year: c.hijriYear, month: def.month, day: def.day });
      expect(estimate, `${c.holidayId}:${c.hijriYear}`).not.toBeNull();
      expect(Math.abs(diffDays(estimate as string, c.date))).toBeLessThanOrEqual(2);
    }
  });
});
