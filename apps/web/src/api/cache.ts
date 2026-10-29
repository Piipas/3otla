import type { Context } from "hono";

/**
 * Data only changes on deploy, and Vercel purges its CDN cache on each deploy, so
 * date-addressed responses can be cached for a long time. Responses that depend on
 * "today" get a short shared cache.
 */
export const CACHE = {
  /** Answer depends only on the request (year, date, range). */
  static: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  /** Answer depends on today's date in Morocco. */
  today: "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
  /** Calendar feeds, polled by calendar apps. */
  ics: "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
} as const;

/** Lets admin decisions purge cached API responses from Vercel's CDN (invalidateByTag). */
export const CDN_TAG = "live-data";

export function cacheFor(c: Context, profile: keyof typeof CACHE) {
  c.header("Cache-Control", CACHE[profile]);
  c.header("Vercel-Cache-Tag", CDN_TAG);
}

/** True when a shared cache (CDN) may store the response and serve it to other clients. */
export function isSharedCacheable(res: Response): boolean {
  const cc = res.headers.get("Cache-Control") ?? "";
  return /\bs-maxage=\d+/.test(cc) && !/\b(no-store|private)\b/.test(cc);
}
