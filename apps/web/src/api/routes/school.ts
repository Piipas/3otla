import {
  type Labels,
  type Locale,
  MAX_NEXT_COUNT,
  nextSchoolBreaks,
  type SchoolBreak,
  schoolYear,
  todayInCasablanca,
} from "@3otla/core";
import { createRoute, z } from "@hono/zod-openapi";
import { cacheFor } from "../cache";
import { type ApiApp, type ApiContext, meta } from "../context";
import {
  ErrorSchema,
  envelope,
  IsoDateParam,
  LocaleSchema,
  type SchoolBreakDto,
  SchoolBreakSchema,
  SchoolCalendarParamSchema,
  SchoolYearSchema,
} from "../schemas";

const errors = {
  400: {
    description: "Invalid parameters",
    content: { "application/json": { schema: ErrorSchema } },
  },
  429: { description: "Rate limited", content: { "application/json": { schema: ErrorSchema } } },
};

const named = (labels: Labels, lang: Locale | undefined) =>
  lang ? { name: labels[lang] } : { labels };

function toBreak(b: SchoolBreak, lang: Locale | undefined): SchoolBreakDto {
  return {
    key: b.key,
    id: b.id,
    calendar: b.calendar,
    schoolYear: b.schoolYear,
    ...named(b.labels, lang),
    date: b.date,
    endDate: b.endDate,
    durationDays: b.durationDays,
    status: b.status,
    ...(b.confirmedAt ? { confirmedAt: b.confirmedAt } : {}),
    ...(b.hijri ? { hijri: b.hijri } : {}),
    sourceUrl: b.sourceUrl,
    ...(b.decisionRefs ? { decisionRefs: b.decisionRefs.map((d) => ({ ...d })) } : {}),
    dateSource: b.dateSource,
  };
}

const yearRoute = createRoute({
  method: "get",
  path: "/v1/school/{calendar}",
  tags: ["School"],
  summary: "School calendar for a school year",
  description:
    "Start and end of classes and every break, from the official calendar (Ministry of National Education decision, or the French Embassy calendar for AEFE schools). School breaks are not public holidays and do not affect `/is-holiday` or `/workdays`.",
  request: {
    params: z.object({ calendar: SchoolCalendarParamSchema }),
    query: z.object({
      schoolYear: z
        .string()
        .regex(/^\d{4}-\d{4}$/)
        .optional()
        .openapi({ example: "2026-2027", description: "Defaults to the current school year." }),
      lang: LocaleSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "School year",
      content: { "application/json": { schema: envelope(SchoolYearSchema) } },
    },
    404: {
      description: "School year not published",
      content: { "application/json": { schema: ErrorSchema } },
    },
    ...errors,
  },
});

const nextRoute = createRoute({
  method: "get",
  path: "/v1/school/{calendar}/next",
  tags: ["School"],
  summary: "Upcoming school breaks",
  description:
    "The next breaks from today in Morocco (or `from`). A break in progress is included.",
  request: {
    params: z.object({ calendar: SchoolCalendarParamSchema }),
    query: z.object({
      count: z.coerce.number().int().min(1).max(MAX_NEXT_COUNT).default(3),
      from: IsoDateParam.optional().openapi({ description: "Defaults to today in Morocco." }),
      lang: LocaleSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "Upcoming breaks",
      content: { "application/json": { schema: envelope(z.array(SchoolBreakSchema)) } },
    },
    ...errors,
  },
});

export function registerSchoolRoutes(app: ApiApp, ctx: ApiContext) {
  app.openapi(yearRoute, (c) => {
    const { calendar } = c.req.valid("param");
    const { schoolYear: wanted, lang } = c.req.valid("query");
    const year = schoolYear(calendar, wanted, todayInCasablanca(ctx.now()));
    cacheFor(c, wanted === undefined ? "today" : "static");
    return c.json(
      {
        data: {
          calendar: year.calendar,
          schoolYear: year.schoolYear,
          sourceUrl: year.sourceUrl,
          ...(year.decisionRefs ? { decisionRefs: year.decisionRefs.map((d) => ({ ...d })) } : {}),
          issuedAt: year.issuedAt,
          classesStart: year.classesStart,
          classesEnd: year.classesEnd,
          classesEndExceptions: year.classesEndExceptions.map((e) => ({
            ...named(e.labels, lang),
            date: e.date,
          })),
          breaks: year.breaks.map((b) => toBreak(b, lang)),
        },
        meta: meta(ctx),
      },
      200,
    );
  });

  app.openapi(nextRoute, (c) => {
    const { calendar } = c.req.valid("param");
    const { count, from, lang } = c.req.valid("query");
    const data = nextSchoolBreaks(from ?? todayInCasablanca(ctx.now()), calendar, count).map((b) =>
      toBreak(b, lang),
    );
    cacheFor(c, from === undefined ? "today" : "static");
    return c.json({ data, meta: meta(ctx) }, 200);
  });
}
