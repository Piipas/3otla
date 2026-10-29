import { dataset } from "@3otla/data";
import { describe, expect, it } from "vitest";
import {
  createSchoolCalendars,
  generateSchoolIcs,
  type HolidayError,
  isHoliday,
  isSchoolBreak,
  nextSchoolBreaks,
  schoolYear,
  schoolYears,
  workdays,
} from "../src/index";

const MEN =
  "https://www.men.gov.ma/sites/default/files/2026-09/%D9%85%D9%82%D8%B1%D8%B1%20047.26.pdf";

describe("public schools 2026-2027 (MEN decision 047.26)", () => {
  const year = schoolYear("school-public", "2026-2027");

  it("has the official start, end and breaks", () => {
    expect(year).toMatchObject({
      classesStart: "2026-09-07",
      classesEnd: "2027-06-26",
      sourceUrl: MEN,
      decisionRefs: [{ ref: "047.26", kind: "ministerial-decision" }],
    });
    expect(year.classesEndExceptions[0]?.date).toBe("2027-05-29");
    const fixed = year.breaks.filter((b) => b.status === "fixed");
    expect(fixed.map((b) => [b.id, b.date, b.endDate, b.durationDays])).toEqual([
      ["first-term-break", "2026-10-18", "2026-10-25", 8],
      ["second-term-break", "2026-12-06", "2026-12-13", 8],
      ["mid-year-break", "2027-01-24", "2027-01-31", 8],
      ["third-term-break", "2027-03-21", "2027-03-28", 8],
      ["fourth-term-break", "2027-05-09", "2027-05-16", 8],
    ]);
  });

  it("estimates the Eid breaks from Hijri dates (Umm al-Qura)", () => {
    const fitr = year.breaks.find((b) => b.id === "eid-al-fitr-break");
    expect(fitr).toMatchObject({
      date: "2027-03-08", // 29 Ramadan 1448
      endDate: "2027-03-10", // 2 Shawwal 1448
      durationDays: 3,
      status: "estimated",
      hijri: { year: 1448, from: { month: 9, day: 29 }, to: { month: 10, day: 2 } },
      dateSource: { kind: "umm-al-qura-estimate" },
    });
    const adha = year.breaks.find((b) => b.id === "eid-al-adha-break");
    expect(adha).toMatchObject({ date: "2027-05-15", endDate: "2027-05-17", durationDays: 3 });
  });

  it("keys are stable and unique", () => {
    const keys = year.breaks.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toBe("school-public:2026-2027:first-term-break");
  });
});

describe("days off in the official annex", () => {
  it("lists the public holidays during the school year, minus those inside a break", () => {
    const year = schoolYear("school-public", "2026-2027");
    // MEN decision 047.26, Annex 1: 8 public holidays besides the 7 breaks.
    expect(year.publicHolidays.map((h) => [h.id, h.date])).toEqual([
      ["unity-day", "2026-10-31"],
      ["green-march", "2026-11-06"],
      ["independence-day", "2026-11-18"],
      ["new-year", "2027-01-01"],
      ["independence-manifesto", "2027-01-11"],
      ["amazigh-new-year", "2027-01-14"],
      ["labour-day", "2027-05-01"],
      ["islamic-new-year", "2027-06-06"], // Umm al-Qura estimate of 1 Muharram 1449,
    ]);
  });
});

describe("queries", () => {
  it("lists available years and picks the current one", () => {
    expect(schoolYears("school-public")).toEqual(["2026-2027"]);
    expect(schoolYear("school-public", undefined, "2026-10-29").schoolYear).toBe("2026-2027");
    // After the last published year ends, the latest one is still returned.
    expect(schoolYear("school-public", undefined, "2027-08-01").schoolYear).toBe("2026-2027");
  });

  it("knows whether a date is in a break, per calendar", () => {
    expect(isSchoolBreak("2026-10-20", "school-public").inBreak).toBe(true);
    expect(isSchoolBreak("2026-10-29", "school-public").inBreak).toBe(false);
    expect(isSchoolBreak("2026-12-06", "school-public").breaks[0]?.id).toBe("second-term-break");
  });

  it("lists upcoming breaks, including one in progress", () => {
    expect(nextSchoolBreaks("2026-10-29", "school-public", 2).map((b) => b.id)).toEqual([
      "second-term-break",
      "mid-year-break",
    ]);
    expect(nextSchoolBreaks("2026-10-20", "school-public", 1)[0]?.id).toBe("first-term-break");
  });

  it("never changes public holidays or workdays", () => {
    expect(isHoliday("2026-12-08").isHoliday).toBe(false);
    expect(workdays("2026-12-07", "2026-12-11").workdays).toBe(5);
  });

  it("rejects unknown calendars and years", () => {
    expect(() => schoolYear("national")).toThrow(/Unknown school calendar/);
    const err = (() => {
      try {
        schoolYear("school-public", "2030-2031");
      } catch (e) {
        return e as HolidayError;
      }
    })();
    expect(err?.code).toBe("unknown_school_year");
    expect(() => nextSchoolBreaks("2026-10-29", "school-public", 0)).toThrow(/count/);
  });
});

describe("confirmations move Hijri breaks", () => {
  it("shifts the Eid al-Fitr break when Eid is announced a day later", () => {
    const school = createSchoolCalendars({
      ...dataset,
      confirmations: [
        {
          holidayId: "eid-al-fitr",
          hijriYear: 1448,
          date: "2027-03-10", // Umm al-Qura: 2027-03-09
          announcedAt: "2027-03-08T19:30:00Z",
          sourceUrl: "https://www.habous.gov.ma/annonce-example",
        },
      ],
    });
    const fitr = school
      .schoolYear("school-public", "2026-2027")
      .breaks.find((b) => b.id === "eid-al-fitr-break");
    expect(fitr).toMatchObject({
      date: "2027-03-09",
      endDate: "2027-03-11",
      status: "confirmed",
      dateSource: { kind: "habous-announcement" },
    });
  });
});

describe("school .ics feed", () => {
  it("emits one all-day event per break", () => {
    const ics = generateSchoolIcs("school-public", {
      lang: "fr",
      baseUrl: "https://3otla.example",
      now: new Date("2026-10-29T00:00:00Z"),
    }).replace(/\r\n /g, "");
    expect(ics).toContain("X-WR-CALNAME:Vacances scolaires au Maroc (enseignement public)");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(7);
    expect(ics).toContain("UID:school-public-2026-2027-second-term-break@3otla");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261206\r\nDTEND;VALUE=DATE:20261214");
    expect(ics).toContain("SUMMARY:Vacances de l’Aïd al-Fitr (date estimée)");
    expect(ics).toContain("URL:https://3otla.example/fr/school#school-public");
  });
});
