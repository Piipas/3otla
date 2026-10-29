import { MAX_NEXT_COUNT, nextHolidays, resolveHolidays, todayInCasablanca } from "@3otla/core";
import { createRoute, z } from "@hono/zod-openapi";
import { cacheFor } from "../cache";
import { type ApiApp, type ApiContext, calendarsFor, meta, toHoliday } from "../context";
import {
  CalendarParamSchema,
  envelope,
  errorResponses,
  HolidaySchema,
  IsoDateParam,
  LocaleSchema,
} from "../schemas";

const listRoute = createRoute({
  method: "get",
  path: "/v1/holidays",
  operationId: "listHolidays",
  tags: ["Holidays"],
  summary: "Holidays of a year",
  description:
    "Every public holiday overlapping the year, sorted by date. A multi-day holiday that starts on 31 December of the previous year is included. A Gregorian year can hold two occurrences of the same Hijri holiday (e.g. Eid al-Fitr in 2033): use `key` to tell them apart.\n\nWithout `year`, answers for the current year in Morocco and is cached for 5 minutes; with `year`, it is cached for a day.",
  request: {
    query: z.object({
      year: z.coerce.number().int().optional().openapi({
        description: "Gregorian year, 2024–2035. Defaults to the current year in Morocco.",
        example: 2027,
      }),
      calendar: CalendarParamSchema,
      lang: LocaleSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "Holidays",
      content: { "application/json": { schema: envelope(z.array(HolidaySchema)) } },
    },
    ...errorResponses,
  },
});

const nextRoute = createRoute({
  method: "get",
  path: "/v1/holidays/next",
  operationId: "nextHolidays",
  tags: ["Holidays"],
  summary: "Upcoming holidays",
  description:
    "The next holidays from today in Morocco (or from `from`). A holiday in progress is included, so on the second day of Eid the first result is that Eid. Ideal for a countdown.",
  request: {
    query: z.object({
      count: z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_NEXT_COUNT)
        .default(5)
        .openapi({ description: `How many holidays, 1–${MAX_NEXT_COUNT}.`, example: 3 }),
      from: IsoDateParam.optional().openapi({
        description: "Start date. Defaults to today in Morocco (Africa/Casablanca).",
        example: "2027-01-01",
      }),
      calendar: CalendarParamSchema,
      lang: LocaleSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "Upcoming holidays",
      content: { "application/json": { schema: envelope(z.array(HolidaySchema)) } },
    },
    ...errorResponses,
  },
});

export function registerHolidayRoutes(app: ApiApp, ctx: ApiContext) {
  app.openapi(listRoute, (c) => {
    const { year, calendar, lang } = c.req.valid("query");
    const resolvedYear = year ?? Number(todayInCasablanca(ctx.now()).slice(0, 4));
    const data = resolveHolidays(resolvedYear, calendarsFor(calendar)).map((o) =>
      toHoliday(o, lang, ctx),
    );
    cacheFor(c, year === undefined ? "today" : "static");
    return c.json({ data, meta: meta(ctx) }, 200);
  });

  app.openapi(nextRoute, (c) => {
    const { count, from, calendar, lang } = c.req.valid("query");
    const data = nextHolidays(
      from ?? todayInCasablanca(ctx.now()),
      count,
      calendarsFor(calendar),
    ).map((o) => toHoliday(o, lang, ctx));
    cacheFor(c, from === undefined ? "today" : "static");
    return c.json({ data, meta: meta(ctx) }, 200);
  });
}
