import { describe, expect, it } from "vitest";
import { generateIcs } from "../src/index";

const base = {
  fromYear: 2026,
  toYear: 2026,
  baseUrl: "https://3otla.example",
  now: new Date("2026-10-29T12:00:00Z"),
};

describe("generateIcs", () => {
  it("national feed (fr) matches snapshot", () => {
    expect(generateIcs("national", { ...base, lang: "fr" })).toMatchSnapshot();
  });

  it("religious feed (ar) matches snapshot", () => {
    expect(generateIcs("religious", { ...base, lang: "ar" })).toMatchSnapshot();
  });

  it("uses CRLF and folds lines at 75 octets without breaking characters", () => {
    for (const lang of ["ar", "fr", "en"] as const) {
      const ics = generateIcs("all", { ...base, lang });
      expect(ics.endsWith("\r\n")).toBe(true);
      expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
      for (const line of ics.split("\r\n")) {
        expect(Buffer.byteLength(line, "utf8"), line).toBeLessThanOrEqual(75);
        expect(line).not.toContain("�");
      }
    }
  });

  it("emits all-day events with exclusive DTEND and tentative estimates", () => {
    const ics = generateIcs("religious", { ...base, lang: "en" });
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("UID:eid-al-adha-1447@3otla");
    expect(unfolded).toContain("DTSTART;VALUE=DATE:20260527\r\nDTEND;VALUE=DATE:20260529");
    expect(unfolded).toContain("SUMMARY:Eid al-Adha (estimated)");
    expect(unfolded).toContain("STATUS:TENTATIVE");
    expect(unfolded).toContain("DTSTAMP:20261029T120000Z");
  });
});
