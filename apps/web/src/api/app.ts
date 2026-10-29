import { type Core, defaultCore } from "@3otla/core";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import type { ContributionStore } from "@/lib/contribution-store";
import type { ApiContext } from "./context";
import { apiError, errorBody, handleError } from "./errors";
import { type RateLimiter, type RateLimitOptions, rateLimit } from "./ratelimit";
import { registerCalendarRoutes } from "./routes/calendars";
import { registerContributionRoutes } from "./routes/contributions";
import { registerDateRoutes } from "./routes/dates";
import { registerHolidayRoutes } from "./routes/holidays";
import { registerSchoolRoutes } from "./routes/school";

const REPO = "https://github.com/Piipas/3otla";

/** Introduction of the API reference (Markdown, rendered by Scalar on /docs). */
function apiIntro(baseUrl: string): string {
  return `Free, open API for Moroccan public holidays and school holidays, in Arabic, French and English. No API key, no sign-up.

Every date says how sure it is (\`status\`) and where it comes from (\`sourceUrl\`). We only use official sources: maroc.ma, the ministries (*.gov.ma) and MAP. Never aggregators or news sites.

## Quick start

\`\`\`bash
# Next public holiday, in French
curl "${baseUrl}/api/v1/holidays/next?count=1&lang=fr"

# Is 18 November 2026 a holiday?
curl "${baseUrl}/api/v1/is-holiday/2026-11-18"

# Working days in November 2026
curl "${baseUrl}/api/v1/workdays?from=2026-11-01&to=2026-11-30"
\`\`\`

\`\`\`js
const res = await fetch("${baseUrl}/api/v1/holidays?year=2027&lang=en");
const { data } = await res.json();
for (const h of data) console.log(h.date, h.name, h.status);
\`\`\`

## Concepts

| Status | Meaning |
| --- | --- |
| \`fixed\` | Gregorian rule (e.g. 18 November). Never moves. |
| \`estimated\` | Religious holiday computed with the Umm al-Qura calendar. Morocco follows local moon sighting, so it can be **one day later**. |
| \`confirmed\` | Officially announced by the Ministry of Habous. \`dateSource.url\` links to the announcement. |

- **Dates** are \`YYYY-MM-DD\` in Morocco's time zone (Africa/Casablanca). \`endDate\` is inclusive.
- **Keys**: \`key\` identifies one occurrence (\`eid-al-fitr:1448\`) and stays the same when an estimate is confirmed. Store it rather than the date.
- **Languages**: pass \`lang=ar|fr|en\` to get \`name\`; omit it to get \`labels\` in all three.
- **Years**: 2024–2035. Outside that range you get \`year_out_of_range\`.
- **Envelope**: successful responses are \`{ "data": …, "meta": { dataVersion, license, attribution, docs } }\`.

## Caching

Responses are served from a CDN. Answers for a given date or year are cached for a day; answers that depend on "today" (no \`year\`, no \`from\`) for 5 minutes. Every response has an \`ETag\`: send it back in \`If-None-Match\` to get a \`304 Not Modified\`. Data only changes when a new version is deployed (\`meta.dataVersion\`).

## Rate limits

Abuse protection only: **60 requests per minute and 2000 per day per IP** (calendar feeds: 120/min, 20 000/day). Cached responses don't count. Above the limit you get \`429\` with \`Retry-After\`. Need more? Cache on your side; the data rarely changes.

## Errors

Errors always look like \`{ "error": { "code", "message", "details?", "docs" } }\` and are never cached.

| HTTP | \`code\` | When |
| --- | --- | --- |
| 400 | \`invalid_request\` | A parameter fails validation (\`details\` lists which). |
| 400 | \`invalid_date\` | Not a real date (e.g. \`2026-02-30\`). |
| 400 | \`invalid_range\` | \`to\` is before \`from\`, or the range is longer than 10 years. |
| 400 | \`year_out_of_range\` | Year outside 2024–2035. |
| 400 | \`invalid_count\` | \`count\` outside 1–50. |
| 404 | \`unknown_school_year\` | School year not published. |
| 404 | \`not_found\` | Unknown route. |
| 429 | \`rate_limited\` | Too many requests. |

## License and attribution

Data is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): use it freely, credit "3otla". Code is MIT. Spotted a mistake or an official announcement? [Contribute](${baseUrl}/en/contribute).`;
}

export interface CreateApiOptions extends Partial<Omit<ApiContext, "core">> {
  /** Data provider; defaults to the repository data only. */
  core?: () => Core | Promise<Core>;
  limiter?: RateLimiter | null;
  rateLimitOptions?: RateLimitOptions;
  /** Where contributions wait for review. Null disables POST /v1/contributions. */
  contributions?: ContributionStore | null;
}

export function createApi(options: CreateApiOptions = {}) {
  const ctx: ApiContext = {
    now: options.now ?? (() => new Date()),
    baseUrl: (options.baseUrl ?? "http://localhost:3000").replace(/\/$/, ""),
    dataVersion: options.dataVersion ?? "dev",
    core: async () => (options.core ? options.core() : defaultCore),
  };

  const app = new OpenAPIHono({
    // Request validation failures use the same error shape as everything else.
    defaultHook: (result, c) => {
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }));
        c.header("Cache-Control", "no-store");
        return c.json(errorBody("invalid_request", "Invalid request parameters", details), 400);
      }
    },
  }).basePath("/api");

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "HEAD", "OPTIONS"],
      exposeHeaders: [
        "ETag",
        "Retry-After",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ],
      maxAge: 86400,
    }),
  );
  app.use(
    "/v1/*",
    rateLimit(
      options.limiter ?? null,
      (path) =>
        path.endsWith(".ics") ? "ics" : path.endsWith("/contributions") ? "contribute" : "api",
      options.rateLimitOptions,
    ),
  );
  app.use("/v1/*", etag({ weak: true }));

  registerHolidayRoutes(app, ctx);
  registerDateRoutes(app, ctx);
  registerSchoolRoutes(app, ctx);
  registerCalendarRoutes(app, ctx);
  registerContributionRoutes(app, options.contributions ?? null);

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "3otla — Moroccan holidays API",
      version: "1.0.0",
      description: apiIntro(ctx.baseUrl),
      contact: { name: "3otla on GitHub", url: REPO },
      license: { name: "Data: CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    },
    servers: [{ url: ctx.baseUrl, description: "Production" }],
    tags: [
      {
        name: "Holidays",
        description: "Public holidays of a year, and the next ones from today.",
      },
      {
        name: "Dates",
        description: "Questions about a date or a range: is it a holiday, how many working days.",
      },
      {
        name: "School",
        description:
          "Official school calendar (Ministry of National Education): classes, breaks and the public holidays in between. School breaks are not public holidays.",
      },
      {
        name: "Calendars",
        description: "iCalendar feeds to subscribe to in any calendar app.",
      },
    ],
    externalDocs: { description: "Source code and data on GitHub", url: REPO },
  });

  app.notFound((c) => apiError(c, 404, "not_found", `No route for ${c.req.method} ${c.req.path}`));
  app.onError(handleError);

  return app;
}
