/**
 * Public contributions: validation shared by the API and the admin page.
 *
 * A contribution is stored as pending (src/lib/contribution-store.ts) until an admin accepts or
 * rejects it on /admin. Accepted religious-holiday announcements apply live, on top of the
 * repository data. Submissions are checked first: the source must be on the official
 * allowlist, and an announced date must be within ±2 days of the Umm al-Qura estimate.
 */
import { diffDays, fromHijri, parseIsoDate, startOfDayInCasablanca } from "@3otla/core";
import { type Confirmation, religiousHolidays } from "@3otla/data";
import { checkSourceUrl } from "@3otla/data/sources";
import { z } from "@hono/zod-openapi";

export const CONTRIBUTION_KINDS = ["confirmation", "correction", "school-calendar"] as const;
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

const HIJRI_HOLIDAYS = religiousHolidays.filter((h) => h.type === "hijri");
const hijriIds = HIJRI_HOLIDAYS.map((h) => h.id) as [string, ...string[]];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((v) => {
    try {
      parseIsoDate(v);
      return true;
    } catch {
      return false;
    }
  }, "Not a valid date");
const text = (max: number) => z.string().trim().max(max);

const common = {
  sourceUrl: z.string().trim().url().max(500),
  /** Optional name or GitHub handle. Published with the issue. */
  contact: text(100).optional(),
  /** Honeypot: hidden in the form, only bots fill it. */
  website: z.string().max(0).optional(),
};

export const ContributionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("confirmation"),
    holidayId: z.enum(hijriIds),
    hijriYear: z.number().int().min(1440).max(1600),
    date: isoDate,
    /** Date and time of the announcement, Morocco local time ("2027-03-08T20:30"). */
    announcedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    details: text(1000).optional(),
    ...common,
  }),
  z.object({
    kind: z.literal("correction"),
    subject: text(120).min(3),
    proposedDate: isoDate.optional(),
    details: text(2000).min(20),
    ...common,
  }),
  z.object({
    kind: z.literal("school-calendar"),
    schoolYear: z.string().regex(/^\d{4}-\d{4}$/),
    details: text(2000).optional(),
    ...common,
  }),
]);

export type Contribution = z.infer<typeof ContributionSchema>;

export type CheckResult =
  | { ok: true; confirmation?: Confirmation }
  | { ok: false; code: "invalid_source" | "implausible_date"; message: string };

/** "2027-03-08T20:30" in Morocco → "2027-03-08T20:30:00+01:00". */
export function moroccoOffsetIso(local: string): string {
  const day = local.slice(0, 10);
  const offsetMin =
    (Date.parse(`${day}T00:00:00Z`) - startOfDayInCasablanca(day).getTime()) / 60000;
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${local}:00${sign}${hh}:${mm}`;
}

/** Rules that need the data, beyond the request schema. */
export function checkContribution(c: Contribution): CheckResult {
  const source = checkSourceUrl(c.sourceUrl);
  if (!source.ok) {
    return {
      ok: false,
      code: "invalid_source",
      message: `sourceUrl rejected: ${source.reason}. Use an official source (maroc.ma, *.gov.ma, MAP).`,
    };
  }
  if (c.kind !== "confirmation") return { ok: true };

  const def = HIJRI_HOLIDAYS.find((h) => h.id === c.holidayId);
  const estimate = def && fromHijri({ year: c.hijriYear, month: def.month, day: def.day });
  if (!estimate || Math.abs(diffDays(estimate, c.date)) > 2) {
    return {
      ok: false,
      code: "implausible_date",
      message: `${c.date} is more than 2 days away from the estimate${estimate ? ` (${estimate})` : ""} for ${c.holidayId} ${c.hijriYear}.`,
    };
  }
  return {
    ok: true,
    confirmation: {
      holidayId: c.holidayId,
      hijriYear: c.hijriYear,
      date: c.date,
      announcedAt: moroccoOffsetIso(c.announcedAt),
      sourceUrl: c.sourceUrl,
    },
  };
}
