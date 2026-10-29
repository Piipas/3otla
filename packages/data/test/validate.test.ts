import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import confirmationsFile from "../confirmations.json" with { type: "json" };
import nationalFile from "../holidays/national.json" with { type: "json" };
import religiousFile from "../holidays/religious.json" with { type: "json" };
import confirmationsSchema from "../schema/confirmations.schema.json" with { type: "json" };
import holidaysSchema from "../schema/holidays.schema.json" with { type: "json" };
import { dataset } from "../src/index";
import { BANNED_HOSTS, checkSourceUrl } from "../src/sources";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateHolidays = ajv.compile(holidaysSchema);
const validateConfirmations = ajv.compile(confirmationsSchema);

const holidayFiles = { national: nationalFile, religious: religiousFile } as const;

function isRealDate(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

describe("schema", () => {
  for (const [name, file] of Object.entries(holidayFiles)) {
    it(`holidays/${name}.json matches holidays.schema.json`, () => {
      expect(validateHolidays(file), ajv.errorsText(validateHolidays.errors)).toBe(true);
    });

    it(`holidays/${name}.json only contains its own calendar`, () => {
      expect(file.calendar).toBe(name);
      for (const h of file.holidays) expect(h.calendar, h.id).toBe(name);
    });
  }

  it("confirmations.json matches confirmations.schema.json", () => {
    expect(
      validateConfirmations(confirmationsFile),
      ajv.errorsText(validateConfirmations.errors),
    ).toBe(true);
  });

  it("rejects an entry without sourceUrl", () => {
    const { sourceUrl: _, ...entry } = nationalFile.holidays[0] as Record<string, unknown>;
    expect(validateHolidays({ calendar: "national", holidays: [entry] })).toBe(false);
  });
});

describe("integrity", () => {
  it("holiday ids are unique across calendars", () => {
    const ids = dataset.holidays.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fixed dates exist (leap year allowed)", () => {
    for (const h of dataset.holidays.filter((h) => h.type === "fixed")) {
      expect(isRealDate(2024, h.month, h.day), h.id).toBe(true);
    }
  });

  it("validTo is not before validFrom", () => {
    for (const h of dataset.holidays) {
      if (h.validTo) expect(h.validTo >= h.validFrom, h.id).toBe(true);
    }
  });

  it("confirmations reference existing Hijri holidays, once per Hijri year", () => {
    const hijriIds = new Set(dataset.holidays.filter((h) => h.type === "hijri").map((h) => h.id));
    const keys = new Set<string>();
    for (const c of dataset.confirmations) {
      expect(hijriIds.has(c.holidayId), c.holidayId).toBe(true);
      const key = `${c.holidayId}:${c.hijriYear}`;
      expect(keys.has(key), `duplicate confirmation ${key}`).toBe(false);
      keys.add(key);
    }
  });
});

describe("source policy", () => {
  const allUrls = [
    ...dataset.holidays.flatMap((h) => [
      { where: h.id, url: h.sourceUrl },
      ...(h.decisionRefs ?? []).flatMap((d) =>
        d.url ? [{ where: `${h.id} ${d.ref}`, url: d.url }] : [],
      ),
    ]),
    ...dataset.confirmations.map((c) => ({
      where: `${c.holidayId}:${c.hijriYear}`,
      url: c.sourceUrl,
    })),
  ];

  it("every holiday has a sourceUrl", () => {
    for (const h of dataset.holidays) expect(h.sourceUrl, h.id).toMatch(/^https:\/\//);
  });

  it("every source is official", () => {
    for (const { where, url } of allUrls) {
      expect(checkSourceUrl(url), `${where}: ${url}`).toEqual({ ok: true });
    }
  });

  it.each(BANNED_HOSTS)("rejects aggregator %s (and subdomains)", (host) => {
    expect(checkSourceUrl(`https://${host}/morocco`).ok).toBe(false);
    expect(checkSourceUrl(`https://www.${host}/morocco`).ok).toBe(false);
  });

  it("rejects non-https and unknown hosts, accepts ministries", () => {
    expect(checkSourceUrl("http://www.maroc.ma/").ok).toBe(false);
    expect(checkSourceUrl("https://example.com/").ok).toBe(false);
    expect(checkSourceUrl("https://notmaroc.ma/").ok).toBe(false);
    expect(checkSourceUrl("https://www.habous.gov.ma/annonce").ok).toBe(true);
    expect(checkSourceUrl("https://www.men.gov.ma/decision.pdf").ok).toBe(true);
  });
});
