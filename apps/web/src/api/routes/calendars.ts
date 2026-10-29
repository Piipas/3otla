import { generateIcs, generateSchoolIcs, SUPPORTED_YEARS, todayInCasablanca } from "@3otla/core";
import { createRoute, z } from "@hono/zod-openapi";
import { cacheFor } from "../cache";
import type { ApiApp, ApiContext } from "../context";
import { errorResponses } from "../schemas";

const FILES = ["all.ics", "national.ics", "religious.ics", "school-public.ics"] as const;

const icsRoute = createRoute({
  method: "get",
  path: "/v1/calendars/{file}",
  operationId: "getCalendarFeed",
  tags: ["Calendars"],
  summary: "Subscribable calendar feed (.ics)",
  description: [
    "iCalendar feed covering last year to two years ahead (the school feed covers published school years).",
    "",
    "Subscribe by URL rather than downloading the file, so your calendar picks up confirmations:",
    "- **Google Calendar**: Other calendars → From URL → paste the feed URL.",
    "- **Apple Calendar**: File → New Calendar Subscription, or open the `webcal://` URL.",
    "- **Outlook**: Add calendar → Subscribe from web.",
    "",
    "Estimated dates are marked `STATUS:TENTATIVE`. Event UIDs are stable, so a confirmed date updates the existing event in place.",
  ].join("\n"),
  request: {
    params: z.object({
      file: z.enum(FILES).openapi({
        description:
          "`all`, `national` or `religious` public holidays, or `school-public` school breaks.",
        example: "national.ics",
      }),
    }),
    query: z.object({
      lang: z.enum(["ar", "fr", "en"]).default("fr").openapi({ description: "Event language." }),
    }),
  },
  responses: {
    200: {
      description: "iCalendar file",
      content: {
        "text/calendar": {
          schema: z.string(),
          example:
            "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//3otla//Moroccan holidays//FR\r\nX-WR-CALNAME:Jours fériés au Maroc\r\n…\r\nEND:VCALENDAR\r\n",
        },
      },
    },
    ...errorResponses,
  },
});

export function registerCalendarRoutes(app: ApiApp, ctx: ApiContext) {
  app.openapi(icsRoute, (c) => {
    const { file } = c.req.valid("param");
    const { lang } = c.req.valid("query");
    const today = todayInCasablanca(ctx.now());
    const year = Number(today.slice(0, 4));
    const calendar = file.replace(/\.ics$/, "");
    // Stable for the whole day so the ETag only changes when content does.
    const now = new Date(`${today}T00:00:00Z`);
    const ics =
      calendar === "school-public"
        ? generateSchoolIcs(calendar, { lang, baseUrl: ctx.baseUrl, now })
        : generateIcs(calendar as "all" | "national" | "religious", {
            lang,
            fromYear: Math.max(SUPPORTED_YEARS.min, year - 1),
            toYear: Math.min(SUPPORTED_YEARS.max, year + 2),
            baseUrl: ctx.baseUrl,
            now,
          });
    cacheFor(c, "ics");
    c.header("Content-Type", "text/calendar; charset=utf-8");
    c.header("Content-Disposition", `inline; filename="3otla-${file}"`);
    return c.body(ics, 200);
  });
}
