import { isHoliday, toHijri, workdays } from "@3otla/core";
import { createRoute, z } from "@hono/zod-openapi";
import { cacheFor } from "../cache";
import { type ApiApp, type ApiContext, calendarsFor, meta, toHoliday } from "../context";
import {
  CalendarParamSchema,
  ErrorSchema,
  envelope,
  HijriDateSchema,
  HolidaySchema,
  IsoDateParam,
  LabelsSchema,
  LocaleSchema,
} from "../schemas";

const errors = {
  400: {
    description: "Invalid parameters",
    content: { "application/json": { schema: ErrorSchema } },
  },
  429: { description: "Rate limited", content: { "application/json": { schema: ErrorSchema } } },
};

const isHolidayRoute = createRoute({
  method: "get",
  path: "/v1/is-holiday/{date}",
  tags: ["Dates"],
  summary: "Is this date a holiday?",
  request: {
    params: z.object({ date: IsoDateParam }),
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
    ...errors,
  },
});

const workdaysRoute = createRoute({
  method: "get",
  path: "/v1/workdays",
  tags: ["Dates"],
  summary: "Working days between two dates",
  description:
    "Inclusive range. Weekend is Saturday and Sunday; holidays falling on weekdays are excluded.",
  request: {
    query: z.object({
      from: IsoDateParam,
      to: IsoDateParam.openapi({ example: "2026-11-30" }),
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
    ...errors,
  },
});

const hijriRoute = createRoute({
  method: "get",
  path: "/v1/hijri/{date}",
  tags: ["Dates"],
  summary: "Hijri date (Umm al-Qura)",
  description:
    "Converts a Gregorian date with the Umm al-Qura calendar. Always an estimate for Morocco, which follows local moon sighting.",
  request: { params: z.object({ date: IsoDateParam }) },
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
    ...errors,
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
