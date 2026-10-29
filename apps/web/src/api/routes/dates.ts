import { isHoliday, toHijri, workdays } from "@3otla/core";
import { createRoute, z } from "@hono/zod-openapi";
import { cacheFor } from "../cache";
import { type ApiApp, type ApiContext, calendarsFor, meta, toHoliday } from "../context";
import {
  CalendarParamSchema,
  envelope,
  errorResponses,
  HijriDateSchema,
  HolidaySchema,
  IsoDateParam,
  LabelsSchema,
  LocaleSchema,
} from "../schemas";

const isHolidayRoute = createRoute({
  method: "get",
  path: "/v1/is-holiday/{date}",
  operationId: "isHoliday",
  tags: ["Dates"],
  summary: "Is this date a holiday?",
  description:
    "Whether a date is a public holiday in Morocco, with the matching holidays. `isWeekend` is true on Saturday and Sunday. School breaks are not public holidays and are never counted here.",
  request: {
    params: z.object({ date: IsoDateParam.openapi({ example: "2026-11-18" }) }),
    query: z.object({ calendar: CalendarParamSchema, lang: LocaleSchema.optional() }),
  },
  responses: {
    200: {
      description: "Result",
      content: {
        "application/json": {
          schema: envelope(
            z.object({
              date: z.string(),
              isHoliday: z.boolean(),
              isWeekend: z.boolean(),
              holidays: z.array(HolidaySchema),
            }),
          ),
        },
      },
    },
    ...errorResponses,
  },
});

const workdaysRoute = createRoute({
  method: "get",
  path: "/v1/workdays",
  operationId: "countWorkdays",
  tags: ["Dates"],
  summary: "Working days between two dates",
  description:
    "Counts working days in an inclusive range of up to 10 years. The weekend is Saturday and Sunday; public holidays on weekdays are not working days. Religious holidays count with their current date (estimated or confirmed).",
  request: {
    query: z.object({
      from: IsoDateParam.openapi({ description: "First day (inclusive).", example: "2026-11-01" }),
      to: IsoDateParam.openapi({ description: "Last day (inclusive).", example: "2026-11-30" }),
      calendar: CalendarParamSchema,
      lang: LocaleSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "Counts",
      content: {
        "application/json": {
          schema: envelope(
            z.object({
              from: z.string(),
              to: z.string(),
              totalDays: z.number().int(),
              workdays: z.number().int(),
              weekendDays: z.number().int(),
              holidayDays: z.number().int().openapi({
                description: "Holiday days on weekdays (weekend holidays count as weekend days).",
              }),
              holidays: z.array(HolidaySchema),
            }),
          ),
        },
      },
    },
    ...errorResponses,
  },
});

const hijriRoute = createRoute({
  method: "get",
  path: "/v1/hijri/{date}",
  operationId: "toHijri",
  tags: ["Dates"],
  summary: "Hijri date (Umm al-Qura)",
  description:
    "Converts a Gregorian date with the Umm al-Qura calendar. Always an estimate for Morocco, which follows local moon sighting.",
  request: { params: z.object({ date: IsoDateParam.openapi({ example: "2027-03-09" }) }) },
  responses: {
    200: {
      description: "Hijri date",
      content: {
        "application/json": {
          schema: envelope(
            HijriDateSchema.extend({
              date: z.string(),
              monthName: LabelsSchema,
              method: z.literal("umm-al-qura"),
              estimated: z.literal(true),
            }),
          ),
        },
      },
    },
    ...errorResponses,
  },
});

export function registerDateRoutes(app: ApiApp, ctx: ApiContext) {
  app.openapi(isHolidayRoute, (c) => {
    const { date } = c.req.valid("param");
    const { calendar, lang } = c.req.valid("query");
    const res = isHoliday(date, calendarsFor(calendar));
    cacheFor(c, "static");
    return c.json(
      {
        data: { ...res, holidays: res.holidays.map((o) => toHoliday(o, lang, ctx)) },
        meta: meta(ctx),
      },
      200,
    );
  });

  app.openapi(workdaysRoute, (c) => {
    const { from, to, calendar, lang } = c.req.valid("query");
    const res = workdays(from, to, calendarsFor(calendar));
    cacheFor(c, "static");
    return c.json(
      {
        data: { ...res, holidays: res.holidays.map((o) => toHoliday(o, lang, ctx)) },
        meta: meta(ctx),
      },
      200,
    );
  });

  app.openapi(hijriRoute, (c) => {
    const { date } = c.req.valid("param");
    const hijri = toHijri(date);
    cacheFor(c, "static");
    return c.json({ data: { date, ...hijri }, meta: meta(ctx) }, 200);
  });
}
