import { z } from "@hono/zod-openapi";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .openapi({ example: "2026-11-18", format: "date" });

export const LocaleSchema = z
  .enum(["ar", "fr", "en"])
  .openapi({ description: "Language of `name`. Omit to get all three `labels`." });

export const CalendarParamSchema = z
  .enum(["all", "national", "religious"])
  .default("all")
  .openapi({ description: "Calendar to include." });

export const LabelsSchema = z
  .object({ ar: z.string(), fr: z.string(), en: z.string() })
  .openapi("Labels");

export const HijriDateSchema = z
  .object({ year: z.number().int(), month: z.number().int(), day: z.number().int() })
  .openapi("HijriDate");

const DecisionRefSchema = z
  .object({
    ref: z.string().openapi({ example: "2.25.1140" }),
    kind: z.enum(["decree", "royal-decision", "ministerial-decision"]).optional(),
    scope: z.enum(["all", "public-sector", "private-sector"]).optional(),
    url: z.string().optional(),
  })
  .openapi("DecisionRef");

const DateSourceSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("rule") }),
    z.object({
      kind: z.literal("umm-al-qura-estimate"),
      note: z.literal("may-differ-by-1-day"),
    }),
    z.object({
      kind: z.literal("habous-announcement"),
      url: z.string(),
      announcedAt: z.string(),
    }),
  ])
  .openapi("DateSource", {
    description:
      "Why the holiday falls on this date: a fixed rule, a Umm al-Qura estimate, or an official Habous announcement.",
  });

export const HolidaySchema = z
  .object({
    key: z.string().openapi({ example: "eid-al-adha:1448" }),
    id: z.string().openapi({ example: "eid-al-adha" }),
    calendar: z.enum(["national", "religious"]),
    type: z.enum(["fixed", "hijri"]),
    name: z.string().optional().openapi({ description: "Present when `lang` is given." }),
    labels: LabelsSchema.optional().openapi({ description: "Present when `lang` is omitted." }),
    date: isoDate.openapi({ description: "First day off." }),
    endDate: isoDate.openapi({ description: "Last day off (inclusive)." }),
    durationDays: z.number().int(),
    status: z.enum(["fixed", "estimated", "confirmed"]).openapi({
      description:
        "`fixed`: Gregorian rule. `estimated`: Umm al-Qura, Morocco may be one day later. `confirmed`: officially announced.",
    }),
    confirmedAt: z.string().optional(),
    hijri: HijriDateSchema.optional(),
    sourceUrl: z.string().openapi({ description: "Official source establishing the holiday." }),
    decisionRefs: z.array(DecisionRefSchema).optional(),
    dateSource: DateSourceSchema,
    url: z.string().openapi({ description: "Holiday page on the website." }),
  })
  .openapi("Holiday");

export const MetaSchema = z
  .object({
    dataVersion: z.string(),
    license: z.literal("CC-BY-4.0"),
    attribution: z.string(),
    docs: z.string(),
  })
  .openapi("Meta");

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: "invalid_date" }),
      message: z.string(),
      details: z.unknown().optional(),
      docs: z.string(),
    }),
  })
  .openapi("Error");

export const envelope = <T extends z.ZodType>(data: T) => z.object({ data, meta: MetaSchema });

export const IsoDateParam = isoDate;

export type Holiday = z.infer<typeof HolidaySchema>;
export type Meta = z.infer<typeof MetaSchema>;
