import { fromHijri } from "@3otla/core";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "@/api/app";
import {
  type ContributionSink,
  githubSinkFromEnv,
  type IssueDraft,
  moroccoOffsetIso,
  PAYLOAD_MARKER,
} from "@/api/contributions";

function fakeSink() {
  const issues: IssueDraft[] = [];
  const sink: ContributionSink = {
    async create(issue) {
      issues.push(issue);
      return { number: 42, url: "https://github.com/Piipas/3otla/issues/42" };
    },
  };
  return { sink, issues };
}

const post = (app: ReturnType<typeof createApi>, body: unknown) =>
  app.request("/api/v1/contributions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// biome-ignore lint/suspicious/noExplicitAny: test helper over JSON bodies
const json = async (res: Response): Promise<any> => res.json();

const fitrEstimate = fromHijri({ year: 1448, month: 10, day: 1 }) as string;
const confirmation = {
  kind: "confirmation",
  holidayId: "eid-al-fitr",
  hijriYear: 1448,
  date: fitrEstimate,
  announcedAt: "2027-03-08T20:30",
  sourceUrl: "https://www.habous.gov.ma/annonce",
};

describe("POST /v1/contributions", () => {
  it("opens an issue with a machine-readable payload for accepted moderation", async () => {
    const { sink, issues } = fakeSink();
    const res = await post(createApi({ contributions: sink }), {
      ...confirmation,
      details: "Communiqué du ministère @someone #12",
      contact: "Amina",
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await json(res)).data).toEqual({
      issue: 42,
      url: "https://github.com/Piipas/3otla/issues/42",
      status: "pending",
    });

    const [issue] = issues;
    expect(issue?.title).toBe(`Confirmation: eid-al-fitr 1448 on ${fitrEstimate}`);
    expect(issue?.labels).toEqual(["contribution", "kind:confirmation"]);
    // Free text is fenced so it cannot mention people or reference issues.
    expect(issue?.body).toContain("~~~text\nCommuniqué du ministère @someone #12\n~~~");
    const payload = JSON.parse(
      issue?.body.split(`<!-- ${PAYLOAD_MARKER}\n`)[1]?.split("\n-->")[0] ?? "",
    );
    expect(payload.confirmation).toEqual({
      holidayId: "eid-al-fitr",
      hijriYear: 1448,
      date: fitrEstimate,
      announcedAt: "2027-03-08T20:30:00+00:00",
      sourceUrl: "https://www.habous.gov.ma/annonce",
    });
    expect(payload.website).toBeUndefined();
  });

  it("rejects aggregators and non-official sources before reaching GitHub", async () => {
    const { sink, issues } = fakeSink();
    const app = createApi({ contributions: sink });
    for (const sourceUrl of [
      "https://www.timeanddate.com/holidays/morocco/",
      "https://example.com/eid",
    ]) {
      const res = await post(app, { ...confirmation, sourceUrl });
      expect(res.status).toBe(422);
      expect((await json(res)).error.code).toBe("invalid_source");
    }
    expect(issues).toHaveLength(0);
  });

  it("rejects a confirmed date far from the estimate", async () => {
    const res = await post(createApi({ contributions: fakeSink().sink }), {
      ...confirmation,
      date: "2027-04-20",
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error.code).toBe("implausible_date");
  });

  it("validates corrections and the honeypot", async () => {
    const app = createApi({ contributions: fakeSink().sink });
    const short = await post(app, {
      kind: "correction",
      subject: "Unity Day",
      details: "wrong",
      sourceUrl: "https://www.maroc.ma/fr",
    });
    expect(short.status).toBe(400);
    const bot = await post(app, {
      kind: "school-calendar",
      schoolYear: "2027-2028",
      sourceUrl: "https://www.men.gov.ma/x.pdf",
      website: "http://spam.example",
    });
    expect(bot.status).toBe(400);
  });

  it("returns 503 when no sink is configured", async () => {
    const res = await post(createApi(), confirmation);
    expect(res.status).toBe(503);
    expect((await json(res)).error.code).toBe("contributions_disabled");
  });

  it("is not part of the public OpenAPI spec", async () => {
    const spec = await json(await createApi().request("/api/openapi.json"));
    expect(Object.keys(spec.paths)).not.toContain("/api/v1/contributions");
  });
});

describe("helpers", () => {
  it("adds Morocco's UTC offset to announcement times", () => {
    expect(moroccoOffsetIso("2026-07-01T21:00")).toBe("2026-07-01T21:00:00+01:00");
  });

  it("posts to the GitHub issues API with the token", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ number: 7, html_url: "https://github.com/o/r/issues/7" }),
    );
    const sink = githubSinkFromEnv(
      { GITHUB_CONTRIBUTIONS_TOKEN: "t", GITHUB_CONTRIBUTIONS_REPO: "o/r" },
      fetchMock as unknown as typeof fetch,
    );
    expect(githubSinkFromEnv({})).toBeNull();
    const out = await sink?.create({ title: "x", body: "y", labels: ["contribution"] });
    expect(out).toEqual({ number: 7, url: "https://github.com/o/r/issues/7" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/o/r/issues");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
  });
});
