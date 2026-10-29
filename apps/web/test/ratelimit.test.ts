import { describe, expect, it, vi } from "vitest";
import { createApi } from "@/api/app";
import { clientIp, limitsFromEnv, type RateLimitDecision, type RateLimiter } from "@/api/ratelimit";

const RESET = Date.now() + 30_000;

function fakeLimiter(decide: (bucket: string, id: string) => Partial<RateLimitDecision>) {
  const calls: [string, string][] = [];
  const limiter: RateLimiter = {
    async limit(bucket, id) {
      calls.push([bucket, id]);
      return {
        success: true,
        limit: 60,
        remaining: 59,
        reset: RESET,
        window: "minute",
        ...decide(bucket, id),
      };
    },
  };
  return { limiter, calls };
}

const make = (limiter: RateLimiter | null, log = vi.fn()) => ({
  app: createApi({ limiter, rateLimitOptions: { timeoutMs: 50, log }, dataVersion: "test" }),
  log,
});

const req = (ip = "203.0.113.7") =>
  ({ headers: { "x-real-ip": ip } }) satisfies RequestInit & { headers: Record<string, string> };

describe("rate limit middleware", () => {
  it("allows requests and keys by IP and bucket", async () => {
    const { limiter, calls } = fakeLimiter(() => ({}));
    const { app } = make(limiter);
    expect((await app.request("/api/v1/holidays?year=2026", req("x"))).status).toBe(200);
    expect((await app.request("/api/v1/calendars/all.ics", req("y"))).status).toBe(200);
    expect(calls).toEqual([
      ["api", "x"],
      ["ics", "y"],
    ]);
  });

  it("returns 429 with Retry-After, limit headers and the error shape", async () => {
    const { limiter } = fakeLimiter(() => ({
      success: false,
      remaining: 0,
      window: "day",
      limit: 2000,
    }));
    const { app } = make(limiter);
    const res = await app.request("/api/v1/holidays?year=2026", req("x"));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(29);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("2000");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("X-RateLimit-Reset")).toBe(String(Math.ceil(RESET / 1000)));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.error).toMatchObject({
      code: "rate_limited",
      details: { limit: 2000, window: "day" },
    });
    expect(body.error.message).toContain("2000 per day");
  });

  it("adds limit headers only to responses the CDN will not share", async () => {
    const { limiter } = fakeLimiter(() => ({ remaining: 41 }));
    const { app } = make(limiter);
    const cached = await app.request("/api/v1/holidays?year=2026", req("x"));
    expect(cached.headers.get("X-RateLimit-Remaining")).toBeNull();
    const error = await app.request("/api/v1/holidays?year=1990", req("x"));
    expect(error.status).toBe(400);
    expect(error.headers.get("X-RateLimit-Remaining")).toBe("41");
  });

  it("fails open when the limiter throws", async () => {
    const limiter: RateLimiter = {
      limit: () => Promise.reject(new Error("ECONNREFUSED upstash")),
    };
    const { app, log } = make(limiter);
    const res = await app.request("/api/v1/holidays?year=2026", req("x"));
    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("failing open"), expect.any(Error));
  });

  it("fails open when the limiter hangs", async () => {
    const limiter: RateLimiter = { limit: () => new Promise(() => {}) };
    const { app, log } = make(limiter);
    const res = await app.request("/api/v1/holidays?year=2026", req("x"));
    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("timed out"));
  });

  it("is disabled without a limiter and skips CORS preflights", async () => {
    const { app } = make(null);
    expect((await app.request("/api/v1/holidays?year=2026")).status).toBe(200);

    const { limiter, calls } = fakeLimiter(() => ({ success: false }));
    const limited = make(limiter).app;
    const preflight = await limited.request("/api/v1/holidays", {
      method: "OPTIONS",
      headers: { Origin: "https://a.example", "Access-Control-Request-Method": "GET" },
    });
    expect(preflight.status).toBe(204);
    expect(calls).toHaveLength(0);
  });

  it("does not limit the OpenAPI document", async () => {
    const { limiter, calls } = fakeLimiter(() => ({ success: false }));
    const { app } = make(limiter);
    expect((await app.request("/api/openapi.json")).status).toBe(200);
    expect(calls).toHaveLength(0);
  });
});

describe("helpers", () => {
  it("reads the client IP", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe(
      "1.1.1.1",
    );
    expect(clientIp(new Headers({ "x-forwarded-for": " 2.2.2.2 , 10.0.0.1" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("reads limits from env with safe fallbacks", () => {
    expect(
      limitsFromEnv({
        RATE_LIMIT_PER_MINUTE: "10",
        RATE_LIMIT_PER_DAY: "abc",
        ICS_RATE_LIMIT_PER_DAY: "-5",
      }),
    ).toEqual({
      api: { perMinute: 10, perDay: 2000 },
      ics: { perMinute: 120, perDay: 20000 },
      contribute: { perMinute: 3, perDay: 10 },
    });
  });
});
