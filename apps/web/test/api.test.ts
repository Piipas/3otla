import { describe, expect, it } from "vitest";
import { createApi } from "@/api/app";

const api = createApi({
  baseUrl: "https://3otla.example",
  dataVersion: "test",
  now: () => new Date("2026-10-29T10:00:00Z"),
});

const get = (path: string, init?: RequestInit) => api.request(`/api${path}`, init);
// biome-ignore lint/suspicious/noExplicitAny: test helper over JSON bodies
const json = async (res: Response): Promise<any> => res.json();

describe("GET /v1/holidays", () => {
  it("returns a year with status, sources and meta", async () => {
    const res = await get("/v1/holidays?year=2027&lang=fr");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.meta).toMatchObject({ dataVersion: "test", license: "CC-BY-4.0" });
    expect(body.data).toHaveLength(15);
    for (const h of body.data) {
      expect(h.status).toMatch(/^(fixed|estimated|confirmed)$/);
      expect(h.sourceUrl).toMatch(/^https:\/\//);
      expect(h.dateSource.kind).toBeDefined();
      expect(typeof h.name).toBe("string");
      expect(h.labels).toBeUndefined();
    }
    const adha = body.data.find((h: { id: string }) => h.id === "eid-al-adha");
    expect(adha).toMatchObject({
      name: "Aïd al-Adha",
      date: "2027-05-16",
      endDate: "2027-05-17",
      status: "estimated",
      url: "https://3otla.example/fr/2027/eid-al-adha",
    });
  });

  it("returns all labels without lang, and filters by calendar", async () => {
    const body = await json(await get("/v1/holidays?year=2026&calendar=national"));
    expect(body.data).toHaveLength(11);
    expect(body.data[0].labels).toEqual({
      ar: "رأس السنة الميلادية",
      fr: "Nouvel An",
      en: "New Year’s Day",
    });
  });

  it("defaults to the current year in Morocco with a short cache", async () => {
    const res = await get("/v1/holidays");
    const body = await json(res);
    expect(body.data.some((h: { key: string }) => h.key === "unity-day:2026")).toBe(true);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("caches explicit years for long and sends a weak ETag", async () => {
    const res = await get("/v1/holidays?year=2027");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );
    const tag = res.headers.get("ETag");
    expect(tag).toMatch(/^W\//);
    const again = await get("/v1/holidays?year=2027", { headers: { "If-None-Match": tag ?? "" } });
    expect(again.status).toBe(304);
  });

  it("rejects out-of-range years and bad params with the error shape", async () => {
    const res = await get("/v1/holidays?year=1999");
    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({
      error: {
        code: "year_out_of_range",
        message: expect.stringContaining("1999"),
        docs: "/docs",
      },
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const bad = await json(await get("/v1/holidays?calendar=school&lang=de"));
    expect(bad.error.code).toBe("invalid_request");
    expect(bad.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      "calendar",
      "lang",
    ]);
  });
});

describe("GET /v1/holidays/next", () => {
  it("lists upcoming holidays from today", async () => {
    const body = await json(await get("/v1/holidays/next?count=2&lang=en"));
    expect(body.data.map((h: { name: string; date: string }) => [h.name, h.date])).toEqual([
      ["Unity Day", "2026-10-31"],
      ["Green March", "2026-11-06"],
    ]);
  });

  it("validates count", async () => {
    expect((await get("/v1/holidays/next?count=0")).status).toBe(400);
    expect((await get("/v1/holidays/next?count=51")).status).toBe(400);
  });
});

describe("GET /v1/is-holiday/{date}", () => {
  it("answers for a holiday", async () => {
    const body = await json(await get("/v1/is-holiday/2026-11-18?lang=ar"));
    expect(body.data).toMatchObject({ date: "2026-11-18", isHoliday: true, isWeekend: false });
    expect(body.data.holidays[0].name).toBe("عيد الاستقلال");
  });

  it("rejects impossible dates", async () => {
    const res = await get("/v1/is-holiday/2026-02-30");
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("invalid_date");
  });
});

describe("GET /v1/workdays", () => {
  it("counts working days", async () => {
    const body = await json(await get("/v1/workdays?from=2026-11-02&to=2026-11-08"));
    expect(body.data).toMatchObject({ totalDays: 7, weekendDays: 2, holidayDays: 1, workdays: 4 });
  });

  it("rejects reversed ranges and missing params", async () => {
    expect((await json(await get("/v1/workdays?from=2026-12-01&to=2026-11-01"))).error.code).toBe(
      "invalid_range",
    );
    expect((await json(await get("/v1/workdays?from=2026-12-01"))).error.code).toBe(
      "invalid_request",
    );
  });
});

describe("GET /v1/hijri/{date}", () => {
  it("converts with Umm al-Qura", async () => {
    const body = await json(await get("/v1/hijri/2027-05-16"));
    expect(body.data).toMatchObject({
      date: "2027-05-16",
      year: 1448,
      month: 12,
      day: 10,
      method: "umm-al-qura",
      estimated: true,
    });
    expect(body.data.monthName.fr).toBe("Dhou al-Hijja");
  });
});

describe("GET /v1/calendars/{file}", () => {
  it("serves an .ics feed", async () => {
    const res = await get("/v1/calendars/national.ics?lang=en");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=21600");
    const ics = await res.text();
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:unity-day-2026@3otla");
    expect(ics).toContain("DTSTAMP:20261029T000000Z");
    expect(ics).not.toContain("eid-al-adha");
  });

  it("rejects unknown feeds", async () => {
    expect((await get("/v1/calendars/school.ics")).status).toBe(400);
  });
});

describe("cross-cutting", () => {
  it("sends CORS headers", async () => {
    const res = await get("/v1/holidays?year=2026", { headers: { Origin: "https://example.org" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const preflight = await get("/v1/holidays", {
      method: "OPTIONS",
      headers: { Origin: "https://example.org", "Access-Control-Request-Method": "GET" },
    });
    expect(preflight.status).toBe(204);
  });

  it("uses the error shape for unknown routes", async () => {
    const res = await get("/v1/nope");
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe("not_found");
  });

  it("serves an OpenAPI 3.1 document with every route", async () => {
    const doc = await json(await get("/openapi.json"));
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths).sort()).toEqual([
      "/api/v1/calendars/{file}",
      "/api/v1/hijri/{date}",
      "/api/v1/holidays",
      "/api/v1/holidays/next",
      "/api/v1/is-holiday/{date}",
      "/api/v1/workdays",
    ]);
  });
});
