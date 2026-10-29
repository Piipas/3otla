/**
 * Abuse protection for the public API: sliding windows per IP, per minute and per day.
 *
 * - Runs at the origin, so responses served by the CDN cache are never counted.
 * - X-RateLimit-* headers are only added to responses the CDN will not share between
 *   clients, otherwise one caller's counters would be served to everyone.
 * - Fails open: if Redis errors or is slow, the request goes through and we log it.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { MiddlewareHandler } from "hono";
import { isSharedCacheable } from "./cache";
import { apiError } from "./errors";

export type Bucket = "api" | "ics" | "contribute";

export interface Limits {
  perMinute: number;
  perDay: number;
}

export interface RateLimitDecision {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the limiting window resets. */
  reset: number;
  /** Which window produced this decision. */
  window: "minute" | "day";
}

export interface RateLimiter {
  limit(bucket: Bucket, identifier: string): Promise<RateLimitDecision>;
}

type Env = Record<string, string | undefined>;

const DEFAULT_LIMITS: Record<Bucket, Limits> = {
  api: { perMinute: 60, perDay: 2000 },
  ics: { perMinute: 120, perDay: 20000 },
  /** Each accepted request opens a GitHub issue. */
  contribute: { perMinute: 3, perDay: 10 },
};

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function limitsFromEnv(env: Env): Record<Bucket, Limits> {
  return {
    api: {
      perMinute: positiveInt(env.RATE_LIMIT_PER_MINUTE, DEFAULT_LIMITS.api.perMinute),
      perDay: positiveInt(env.RATE_LIMIT_PER_DAY, DEFAULT_LIMITS.api.perDay),
    },
    ics: {
      perMinute: positiveInt(env.ICS_RATE_LIMIT_PER_MINUTE, DEFAULT_LIMITS.ics.perMinute),
      perDay: positiveInt(env.ICS_RATE_LIMIT_PER_DAY, DEFAULT_LIMITS.ics.perDay),
    },
    contribute: DEFAULT_LIMITS.contribute,
  };
}

export function createUpstashLimiter(redis: Redis, limits: Record<Bucket, Limits>): RateLimiter {
  const make = (bucket: Bucket, window: "minute" | "day") => {
    const { perMinute, perDay } = limits[bucket];
    return new Ratelimit({
      redis,
      prefix: `3otla:rl:${bucket}:${window}`,
      limiter:
        window === "minute"
          ? Ratelimit.slidingWindow(perMinute, "1 m")
          : Ratelimit.slidingWindow(perDay, "1 d"),
      ephemeralCache: new Map(),
      analytics: false,
    });
  };
  const limiters = {
    api: { minute: make("api", "minute"), day: make("api", "day") },
    ics: { minute: make("ics", "minute"), day: make("ics", "day") },
    contribute: { minute: make("contribute", "minute"), day: make("contribute", "day") },
  };

  return {
    async limit(bucket, identifier) {
      const [minute, day] = await Promise.all([
        limiters[bucket].minute.limit(identifier),
        limiters[bucket].day.limit(identifier),
      ]);
      const pick = (r: typeof minute, window: "minute" | "day"): RateLimitDecision => ({
        success: r.success,
        limit: r.limit,
        remaining: r.remaining,
        reset: r.reset,
        window,
      });
      if (!minute.success) return pick(minute, "minute");
      if (!day.success) return pick(day, "day");
      return minute.remaining <= day.remaining ? pick(minute, "minute") : pick(day, "day");
    },
  };
}

/** Builds the limiter from env, or null when Upstash is not configured (local dev). */
export function limiterFromEnv(env: Env): RateLimiter | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return createUpstashLimiter(new Redis({ url, token }), limitsFromEnv(env));
}

/** Client IP as set by Vercel's edge (x-real-ip), falling back to the first x-forwarded-for hop. */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

export interface RateLimitOptions {
  /** Max time to wait for Redis before failing open. */
  timeoutMs?: number;
  log?: (message: string, error?: unknown) => void;
}

const TIMEOUT = Symbol("timeout");

export function rateLimit(
  limiter: RateLimiter | null,
  bucketFor: (path: string) => Bucket,
  { timeoutMs = 1000, log = console.warn }: RateLimitOptions = {},
): MiddlewareHandler {
  return async (c, next) => {
    if (!limiter || c.req.method === "OPTIONS") return next();

    const bucket = bucketFor(c.req.path);
    let decision: RateLimitDecision | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        limiter.limit(bucket, clientIp(c.req.raw.headers)),
        new Promise<typeof TIMEOUT>((resolve) => {
          timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
        }),
      ]);
      if (result === TIMEOUT) log(`[ratelimit] timed out after ${timeoutMs}ms, failing open`);
      else decision = result;
    } catch (error) {
      log("[ratelimit] limiter unavailable, failing open", error);
    } finally {
      clearTimeout(timer);
    }

    if (decision && !decision.success) {
      const retryAfter = Math.max(1, Math.ceil((decision.reset - Date.now()) / 1000));
      c.header("X-RateLimit-Limit", String(decision.limit));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(Math.ceil(decision.reset / 1000)));
      c.header("Retry-After", String(retryAfter));
      const per = decision.window === "minute" ? "minute" : "day";
      return apiError(
        c,
        429,
        "rate_limited",
        `Too many requests: limit is ${decision.limit} per ${per} per IP. Retry in ${retryAfter}s.`,
        { limit: decision.limit, window: decision.window, retryAfter },
      );
    }

    await next();

    if (decision && !isSharedCacheable(c.res)) setHeaders(c.res.headers, decision);
  };
}

function setHeaders(headers: Headers, d: RateLimitDecision) {
  headers.set("X-RateLimit-Limit", String(d.limit));
  headers.set("X-RateLimit-Remaining", String(Math.max(0, d.remaining)));
  headers.set("X-RateLimit-Reset", String(Math.ceil(d.reset / 1000)));
}
