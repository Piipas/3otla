import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import type { ApiContext } from "./context";
import { apiError, errorBody, handleError } from "./errors";
import { type RateLimiter, type RateLimitOptions, rateLimit } from "./ratelimit";
import { registerCalendarRoutes } from "./routes/calendars";
import { registerDateRoutes } from "./routes/dates";
import { registerHolidayRoutes } from "./routes/holidays";
import { registerSchoolRoutes } from "./routes/school";

export interface CreateApiOptions extends Partial<ApiContext> {
  limiter?: RateLimiter | null;
  rateLimitOptions?: RateLimitOptions;
}

export function createApi(options: CreateApiOptions = {}) {
  const ctx: ApiContext = {
    now: options.now ?? (() => new Date()),
    baseUrl: (options.baseUrl ?? "http://localhost:3000").replace(/\/$/, ""),
    dataVersion: options.dataVersion ?? "dev",
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
      (path) => (path.endsWith(".ics") ? "ics" : "api"),
      options.rateLimitOptions,
    ),
  );
  app.use("/v1/*", etag({ weak: true }));

  registerHolidayRoutes(app, ctx);
  registerDateRoutes(app, ctx);
  registerSchoolRoutes(app, ctx);
  registerCalendarRoutes(app, ctx);

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "3otla — Moroccan holidays API",
      version: "1.0.0",
      description: [
        "Free and open API for Moroccan public holidays (national and religious), in Arabic, French and English.",
        "",
        "Every holiday carries a `status` (`fixed`, `estimated`, `confirmed`) and its official `sourceUrl`.",
        "Religious dates are Umm al-Qura estimates until confirmed by the Ministry of Habous; Morocco may observe them one day later.",
        "",
        "**Rate limits** (abuse protection): 60 requests/minute and 2000/day per IP, looser for `.ics` feeds. Responses served from the CDN cache are not counted. Exceeding a limit returns `429` with `Retry-After`.",
        "",
        "Data license: CC BY 4.0. Code license: MIT.",
      ].join("\n"),
      license: { name: "CC BY 4.0 (data)", url: "https://creativecommons.org/licenses/by/4.0/" },
    },
    servers: [{ url: ctx.baseUrl }],
  });

  app.notFound((c) => apiError(c, 404, "not_found", `No route for ${c.req.method} ${c.req.path}`));
  app.onError(handleError);

  return app;
}
