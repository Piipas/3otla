import { MAX_NEXT_COUNT, nextHolidays, resolveHolidays, todayInCasablanca } from "@3otla/core";
import { createRoute, z } from "@hono/zod-openapi";
import { cacheFor } from "../cache";
import { type ApiApp, type ApiContext, calendarsFor, meta, toHoliday } from "../context";
import {
  CalendarParamSchema,
  ErrorSchema,
  envelope,
  HolidaySchema,
  IsoDateParam,
  LocaleSchema,
} from "../schemas";

const errors = {
  400: {
    description: "Invalid parameters",
    content: { "application/json": { schema: ErrorSchema } },
  },
  429: { description: "Rate limited", content: { "application/json": { schema: ErrorSchema } } },
};

const listRoute = createRoute({
  method: "get",
  path: "/v1/holidays",
  tags: ["Holidays"],
  summary: "Holidays of a year",
  description:
    "All holidays overlapping the given year, sorted by date. A multi-day holiday starting on Dec 31 of the previous year is included.",
  request: {
    query: z.object({
      year: z.coerce.number().int().optional().openapi({
        description: "Gregorian year. Defaults to the current year in Morocco.",
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
    ...errors,
  },
});

const nextRoute = createRoute({
  method: "get",
  path: "/v1/holidays/next",
  tags: ["Holidays"],
  summary: "Upcoming holidays",
  description:
    "The next holidays from today in Morocco (or `from`). A holiday in progress is included.",
  request: {
    query: z.object({
      count: z.coerce.number().int().min(1).max(MAX_NEXT_COUNT).default(5),
      from: IsoDateParam.optional().openapi({ description: "Defaults to today in Morocco." }),
      calendar: CalendarParamSchema,
      lang: LocaleSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "Upcoming holidays",
      content: { "application/json": { schema: envelope(z.array(HolidaySchema)) } },
    },
    ...errors,
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
