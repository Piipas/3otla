import { describe, expect, it } from "vitest";
import { createApi } from "@/api/app";

const api = createApi({
  baseUrl: "https://3otla.example",
  dataVersion: "test",
  now: () => new Date("2026-10-29T10:00:00Z"),
});

const get = (path: string) => api.request(`/api${path}`);
// biome-ignore lint/suspicious/noExplicitAny: test helper over JSON bodies
const json = async (res: Response): Promise<any> => res.json();

describe("GET /v1/school/{calendar}", () => {
  it("returns the current public school year with its official source", async () => {
    const res = await get("/v1/school/school-public?lang=fr");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
    const { data } = await json(res);
    expect(data).toMatchObject({
      calendar: "school-public",
      schoolYear: "2026-2027",
      classesStart: "2026-09-07",
      classesEnd: "2027-06-26",
      decisionRefs: [{ ref: "047.26" }],
    });
    expect(data.sourceUrl).toMatch(/^https:\/\/www\.men\.gov\.ma\//);
    expect(data.classesEndExceptions[0]).toEqual({
      name: "2ᵉ année du baccalauréat",
      date: "2027-05-29",
    });
    expect(data.breaks).toHaveLength(7);
    const fitr = data.breaks.find((b: { id: string }) => b.id === "eid-al-fitr-break");
    expect(fitr).toMatchObject({ name: "Vacances de l’Aïd al-Fitr", status: "estimated" });
    expect(data.publicHolidays).toHaveLength(8);
    expect(data.publicHolidays[0]).toMatchObject({ id: "unity-day", date: "2026-10-31" });
  });

  it("returns a specific year with all labels and a long cache", async () => {
    const res = await get("/v1/school/school-public?schoolYear=2026-2027");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
    const { data } = await json(res);
    expect(data.breaks[0]).toMatchObject({
      id: "first-term-break",
      labels: {
        ar: "الفترة البينية الأولى",
        fr: "Vacances intermédiaires (1ʳᵉ période)",
        en: "First term break",
      },
      date: "2026-10-18",
      endDate: "2026-10-25",
    });
  });

  it("404s on unpublished years and 400s on unknown calendars", async () => {
    const missing = await get("/v1/school/school-public?schoolYear=2030-2031");
    expect(missing.status).toBe(404);
    expect((await json(missing)).error.code).toBe("unknown_school_year");
    const bad = await get("/v1/school/national");
    expect(bad.status).toBe(400);
    expect((await json(bad)).error.code).toBe("invalid_request");
  });
});

describe("GET /v1/school/{calendar}/next", () => {
  it("lists the next breaks from today", async () => {
    const { data } = await json(await get("/v1/school/school-public/next?count=2&lang=en"));
    expect(data.map((b: { name: string; date: string }) => [b.name, b.date])).toEqual([
      ["Second term break", "2026-12-06"],
      ["Mid-year break", "2027-01-24"],
    ]);
  });

  it("includes a break in progress", async () => {
    const api = createApi({
      baseUrl: "https://3otla.example",
      dataVersion: "test",
      now: () => new Date("2026-10-20T10:00:00Z"),
    });
    const res = await api.request("/api/v1/school/school-public/next?count=1");
    expect((await json(res)).data[0].id).toBe("first-term-break");
  });
});

describe("school .ics feeds", () => {
  it("serves the public school feed", async () => {
    const res = await get("/v1/calendars/school-public.ics?lang=ar");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect((await res.text()).match(/BEGIN:VEVENT/g)).toHaveLength(7);
  });

  it("no longer serves the French schools feed", async () => {
    expect((await get("/v1/calendars/school-aefe.ics")).status).toBe(400);
  });
});
