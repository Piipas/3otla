import { generateIcs, SUPPORTED_YEARS, todayInCasablanca } from "@3otla/core";
import { createRoute, z } from "@hono/zod-openapi";
import { cacheFor } from "../cache";
import type { ApiApp, ApiContext } from "../context";
import { ErrorSchema } from "../schemas";

const FILES = ["all.ics", "national.ics", "religious.ics"] as const;

const icsRoute = createRoute({
  method: "get",
  path: "/v1/calendars/{file}",
  tags: ["Calendars"],
  summary: "Subscribable calendar feed (.ics)",
  description:
    "iCalendar feed covering last year to two years ahead. Subscribe by URL in Google Calendar, Apple Calendar or Outlook. Estimated dates are marked TENTATIVE and update in place once confirmed.",
  request: {
    params: z.object({
      file: z.enum(FILES).openapi({ example: "national.ics" }),
    }),
    query: z.object({
      lang: z.enum(["ar", "fr", "en"]).default("fr").openapi({ description: "Event language." }),
    }),
  },
  responses: {
    200: {
      description: "iCalendar file",
      content: { "text/calendar": { schema: z.string() } },
    },
    400: {
      description: "Invalid parameters",
      content: { "application/json": { schema: ErrorSchema } },
    },
    429: { description: "Rate limited", content: { "application/json": { schema: ErrorSchema } } },
  },
});

export function registerCalendarRoutes(app: ApiApp, ctx: ApiContext) {
  app.openapi(icsRoute, (c) => {
    const { file } = c.req.valid("param");
    const { lang } = c.req.valid("query");
    const today = todayInCasablanca(ctx.now());
    const year = Number(today.slice(0, 4));
    const calendar = file.replace(/\.ics$/, "") as "all" | "national" | "religious";
    const ics = generateIcs(calendar, {
      lang,
      fromYear: Math.max(SUPPORTED_YEARS.min, year - 1),
      toYear: Math.min(SUPPORTED_YEARS.max, year + 2),
      baseUrl: ctx.baseUrl,
      // Stable for the whole day so the ETag only changes when content does.
      now: new Date(`${today}T00:00:00Z`),
    });
    cacheFor(c, "ics");
    c.header("Content-Type", "text/calendar; charset=utf-8");
    c.header("Content-Disposition", `inline; filename="3otla-${file}"`);
    return c.body(ics, 200);
  });
}
