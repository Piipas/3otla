import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import schoolSchema from "../schema/school-calendar.schema.json" with { type: "json" };
import { dataset, type FixedSchoolBreak, SCHOOL_CALENDARS, schoolCalendars } from "../src/index";
import { checkSourceUrl } from "../src/sources";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schoolSchema);

const SCHOOL_DIR = join(import.meta.dirname, "..", "school");
const filesOnDisk = SCHOOL_CALENDARS.flatMap((calendar) =>
  readdirSync(join(SCHOOL_DIR, calendar)).map((file) => ({
    calendar,
    file,
    json: JSON.parse(readFileSync(join(SCHOOL_DIR, calendar, file), "utf8")),
  })),
);

const isFixed = (b: object): b is FixedSchoolBreak => "start" in b;

describe("school calendar files", () => {
  it("every file on disk is registered in src/index.ts", () => {
    expect(filesOnDisk.length).toBe(schoolCalendars.length);
    for (const { calendar, json } of filesOnDisk) {
      expect(
        schoolCalendars.some((c) => c.calendar === calendar && c.schoolYear === json.schoolYear),
        `${calendar}/${json.schoolYear}`,
      ).toBe(true);
    }
  });

  for (const { calendar, file, json } of filesOnDisk) {
    describe(`${calendar}/${file}`, () => {
      it("matches school-calendar.schema.json", () => {
        expect(validate(json), ajv.errorsText(validate.errors)).toBe(true);
      });

      it("is stored under its calendar and school year", () => {
        expect(json.calendar).toBe(calendar);
        expect(file).toBe(`${json.schoolYear}.json`);
        const [from, to] = json.schoolYear.split("-").map(Number);
        expect(to).toBe(from + 1);
      });

      it("cites an official source", () => {
        expect(checkSourceUrl(json.sourceUrl)).toEqual({ ok: true });
      });

      it("has coherent dates", () => {
        const [from, to] = json.schoolYear.split("-");
        expect(json.classesStart.startsWith(from)).toBe(true);
        expect(json.classesEnd.startsWith(to)).toBe(true);
        expect(json.issuedAt <= json.classesStart).toBe(true);
        const ids = json.breaks.map((b: { id: string }) => b.id);
        expect(new Set(ids).size).toBe(ids.length);

        const fixed = json.breaks.filter(isFixed) as FixedSchoolBreak[];
        for (const b of fixed) {
          expect(b.start <= b.end, b.id).toBe(true);
          expect(b.start > json.classesStart && b.end < json.classesEnd, b.id).toBe(true);
        }
        const sorted = [...fixed].sort((a, b) => a.start.localeCompare(b.start));
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1] as FixedSchoolBreak;
          const next = sorted[i] as FixedSchoolBreak;
          expect(prev.end < next.start, `${prev.id} overlaps ${next.id}`).toBe(true);
        }
      });

      it("anchors Hijri breaks on existing religious holidays", () => {
        const religious = new Set(
          dataset.holidays.filter((h) => h.type === "hijri").map((h) => h.id),
        );
        for (const b of json.breaks) {
          if ("hijri" in b) expect(religious.has(b.hijri.anchor), b.id).toBe(true);
        }
      });
    });
  }
});
