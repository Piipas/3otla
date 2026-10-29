import { z } from "@hono/zod-openapi";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .openapi({ example: "2026-11-18", format: "date" });

export const LocaleSchema = z.enum(["ar", "fr", "en"]).openapi({
  description:
    "Language of `name`. Omit it to get `labels` with all three languages instead (`ar` is Moroccan Arabic, `fr` French, `en` English).",
  example: "fr",
});

export const CalendarParamSchema = z.enum(["all", "national", "religious"]).default("all").openapi({
  description:
    "`national`: fixed Gregorian holidays (Independence Day, Throne Day…). `religious`: Hijri holidays (Eid, Mawlid, Islamic New Year). `all`: both.",
  example: "all",
});

export const LabelsSchema = z
  .object({ ar: z.string(), fr: z.string(), en: z.string() })
  .openapi("Labels", {
    description: "The name in each supported language.",
    example: { ar: "عيد الفطر", fr: "Aïd al-Fitr", en: "Eid al-Fitr" },
  });

export const HijriDateSchema = z
  .object({
    year: z.number().int().openapi({ example: 1448 }),
    month: z.number().int().min(1).max(12).openapi({ example: 10 }),
    day: z.number().int().min(1).max(30).openapi({ example: 1 }),
  })
  .openapi("HijriDate", { description: "A date in the Umm al-Qura Hijri calendar." });

const DecisionRefSchema = z
  .object({
    ref: z.string().openapi({ example: "2.25.1140" }),
    kind: z.enum(["decree", "royal-decision", "ministerial-decision"]).optional(),
    scope: z.enum(["all", "public-sector", "private-sector"]).optional().openapi({
      description: "Who the text applies to, when public and private sectors differ.",
    }),
    url: z.string().optional(),
  })
  .openapi("DecisionRef", { description: "Official text (decree, decision) behind a rule." });

const DateSourceSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("rule") }),
    z.object({
      kind: z.literal("umm-al-qura-estimate"),
      note: z.literal("may-differ-by-1-day"),
    }),
    z.object({
      kind: z.literal("habous-announcement"),
      url: z.string().openapi({ description: "Official announcement." }),
      announcedAt: z.string().openapi({ example: "2027-03-08T20:30:00+00:00" }),
    }),
  ])
  .openapi("DateSource", {
    description:
      "Why the holiday falls on this date: a fixed rule, a Umm al-Qura estimate, or an official announcement by the Ministry of Habous.",
  });

const StatusSchema = z.enum(["fixed", "estimated", "confirmed"]).openapi("Status", {
  description: [
    "How certain the date is:",
    "- `fixed`: set by a Gregorian rule, never moves.",
    "- `estimated`: Umm al-Qura calculation. Morocco follows local moon sighting, so the real date can be one day later.",
    "- `confirmed`: officially announced by the Ministry of Habous; `dateSource` links to the announcement.",
  ].join("\n"),
});

export const HolidaySchema = z
  .object({
    key: z.string().openapi({
      description:
        "Stable identifier of this occurrence (`id:hijriYear` or `id:year`). It does not change when an estimated date is confirmed, so it is safe to store.",
    }),
    id: z.string().openapi({ description: "Holiday identifier, the same every year." }),
    calendar: z.enum(["national", "religious"]),
    type: z.enum(["fixed", "hijri"]).openapi({
      description: "`fixed`: Gregorian month/day. `hijri`: Hijri month/day.",
    }),
    name: z.string().optional().openapi({ description: "Present when `lang` is given." }),
    labels: LabelsSchema.optional().openapi({ description: "Present when `lang` is omitted." }),
    date: isoDate.openapi({ description: "First day off." }),
    endDate: isoDate.openapi({ description: "Last day off (inclusive)." }),
    durationDays: z.number().int().min(1),
    status: StatusSchema,
    confirmedAt: z.string().optional().openapi({ description: "When the date was announced." }),
    hijri: HijriDateSchema.optional().openapi({ description: "First day, for Hijri holidays." }),
    sourceUrl: z.string().openapi({ description: "Official source establishing the holiday." }),
    decisionRefs: z.array(DecisionRefSchema).optional(),
    dateSource: DateSourceSchema,
    url: z.string().openapi({ description: "Holiday page on the website." }),
  })
  .openapi("Holiday", {
    example: {
      key: "eid-al-fitr:1448",
      id: "eid-al-fitr",
      calendar: "religious",
      type: "hijri",
      name: "Eid al-Fitr",
      date: "2027-03-09",
      endDate: "2027-03-10",
      durationDays: 2,
      status: "estimated",
      hijri: { year: 1448, month: 10, day: 1 },
      sourceUrl: "https://www.maroc.ma/index%2Ephp/en/morocco/religious-and-national-holidays",
      dateSource: { kind: "umm-al-qura-estimate", note: "may-differ-by-1-day" },
      url: "https://3otla.vercel.app/en/2027/eid-al-fitr",
    },
  });

export const MetaSchema = z
  .object({
    dataVersion: z.string().openapi({
      description: "Changes with every data release (git commit).",
      example: "028eb51",
    }),
    license: z.literal("CC-BY-4.0"),
    attribution: z.string().openapi({ example: "Data: 3otla — Moroccan holidays (CC BY 4.0)" }),
    docs: z.string().openapi({ example: "https://3otla.vercel.app/docs" }),
  })
  .openapi("Meta", { description: "Sent with every successful response." });

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({
        description: "Stable, machine-readable code. See the error table in the introduction.",
        example: "invalid_date",
      }),
      message: z.string().openapi({ example: '"2026-13-01" is not a valid YYYY-MM-DD date' }),
      details: z.unknown().optional(),
      docs: z.string().openapi({ example: "/docs" }),
    }),
  })
  .openapi("Error");

export const envelope = <T extends z.ZodType>(data: T) => z.object({ data, meta: MetaSchema });

const errorExample = (code: string, message: string, details?: unknown) => ({
  error: { code, message, ...(details === undefined ? {} : { details }), docs: "/docs" },
});

const rateLimitHeaders = {
  "Retry-After": { description: "Seconds to wait.", schema: { type: "integer" as const } },
  "X-RateLimit-Limit": { schema: { type: "integer" as const } },
  "X-RateLimit-Remaining": { schema: { type: "integer" as const } },
  "X-RateLimit-Reset": { description: "Unix time (s).", schema: { type: "integer" as const } },
};

/** Error responses shared by every route, with realistic examples. */
export const errorResponses = {
  400: {
    description: "Invalid parameters",
    content: {
      "application/json": {
        schema: ErrorSchema,
        examples: {
          invalid_date: {
            summary: "Not a real date",
            value: errorExample("invalid_date", '"2026-13-01" is not a valid YYYY-MM-DD date'),
          },
          year_out_of_range: {
            summary: "Unsupported year",
            value: errorExample(
              "year_out_of_range",
              "Year 2050 is outside the supported range 2024–2035",
            ),
          },
          invalid_request: {
            summary: "Schema validation",
            value: errorExample("invalid_request", "Invalid request parameters", [
              { path: "count", message: "Too big: expected number to be <=50" },
            ]),
          },
        },
      },
    },
  },
  429: {
    description: "Rate limited. Wait `Retry-After` seconds.",
    headers: rateLimitHeaders,
    content: {
      "application/json": {
        schema: ErrorSchema,
        example: errorExample(
          "rate_limited",
          "Too many requests: limit is 60 per minute per IP. Retry in 12s.",
          { limit: 60, window: "minute", retryAfter: 12 },
        ),
      },
    },
  },
} as const;

export const notFoundSchoolYear = {
  404: {
    description: "School year not published (yet)",
    content: {
      "application/json": {
        schema: ErrorSchema,
        example: errorExample(
          "unknown_school_year",
          "No school-public calendar for 2030-2031. Available: 2026-2027",
        ),
      },
    },
  },
} as const;

export const IsoDateParam = isoDate;

export const SchoolCalendarParamSchema = z.enum(["school-public"]).openapi({
  description: "`school-public`: public schools, from the Ministry of National Education decision.",
  example: "school-public",
});

const HijriDaySchema = z.object({ month: z.number().int(), day: z.number().int() });

export const SchoolBreakSchema = z
  .object({
    key: z.string().openapi({ description: "Stable identifier, safe to store." }),
    id: z.string(),
    calendar: z.enum(["school-public"]),
    schoolYear: z.string(),
    name: z.string().optional().openapi({ description: "Present when `lang` is given." }),
    labels: LabelsSchema.optional().openapi({ description: "Present when `lang` is omitted." }),
    date: isoDate.openapi({ description: "First day without classes." }),
    endDate: isoDate.openapi({ description: "Last day without classes (inclusive)." }),
    durationDays: z.number().int().min(1),
    status: StatusSchema.openapi({
      description:
        "`fixed`: dates set by the official calendar. Breaks tied to Eid are `estimated` until the Eid date is officially announced, then `confirmed` and shifted with it.",
    }),
    confirmedAt: z.string().optional(),
    hijri: z
      .object({ year: z.number().int(), from: HijriDaySchema, to: HijriDaySchema })
      .optional()
      .openapi({ description: "Hijri bounds, for breaks tied to Eid." }),
    sourceUrl: z.string().openapi({ description: "Official school calendar document." }),
    decisionRefs: z.array(DecisionRefSchema).optional(),
    dateSource: DateSourceSchema,
  })
  .openapi("SchoolBreak", {
    example: {
      key: "school-public:2026-2027:eid-al-fitr-break",
      id: "eid-al-fitr-break",
      calendar: "school-public",
      schoolYear: "2026-2027",
      name: "Eid al-Fitr break",
      date: "2027-03-08",
      endDate: "2027-03-10",
      durationDays: 3,
      status: "estimated",
      hijri: { year: 1448, from: { month: 9, day: 29 }, to: { month: 10, day: 2 } },
      sourceUrl:
        "https://www.men.gov.ma/sites/default/files/2026-09/%D9%85%D9%82%D8%B1%D8%B1%20047.26.pdf",
      decisionRefs: [{ ref: "047.26", kind: "ministerial-decision" }],
      dateSource: { kind: "umm-al-qura-estimate", note: "may-differ-by-1-day" },
    },
  });

export const SchoolYearSchema = z
  .object({
    calendar: z.enum(["school-public"]),
    schoolYear: z.string().openapi({ example: "2026-2027" }),
    sourceUrl: z.string().openapi({ description: "The official decision (PDF)." }),
    decisionRefs: z.array(DecisionRefSchema).optional(),
    issuedAt: isoDate.openapi({ example: "2026-07-03" }),
    classesStart: isoDate.openapi({ example: "2026-09-07" }),
    classesEnd: isoDate.openapi({ example: "2027-06-26" }),
    classesEndExceptions: z
      .array(
        z.object({ name: z.string().optional(), labels: LabelsSchema.optional(), date: isoDate }),
      )
      .openapi({ description: "Classes that end earlier, e.g. the final baccalaureate year." }),
    breaks: z.array(SchoolBreakSchema),
    publicHolidays: z.array(HolidaySchema).openapi({
      description:
        "Public holidays between the first and last day of classes, except those inside a break (Eid falls inside its Eid break). With `breaks`, this is every day off listed in the official calendar.",
    }),
  })
  .openapi("SchoolYear");

export type SchoolBreakDto = z.infer<typeof SchoolBreakSchema>;
export type Holiday = z.infer<typeof HolidaySchema>;
export type Meta = z.infer<typeof MetaSchema>;
