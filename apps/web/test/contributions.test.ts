import { createCore, fromHijri, withConfirmations } from "@3otla/core";
import { dataset } from "@3otla/data";
import { describe, expect, it } from "vitest";
import { createApi } from "@/api/app";
import { moroccoOffsetIso } from "@/api/contributions";
import { isAllowed, signSession, verifySession } from "@/lib/admin-auth";
import { createMemoryStore, StoreError } from "@/lib/contribution-store";

const post = (app: ReturnType<typeof createApi>, body: unknown) =>
  app.request("/api/v1/contributions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// biome-ignore lint/suspicious/noExplicitAny: test helper over JSON bodies
const json = async (res: Response): Promise<any> => res.json();

const fitrEstimate = fromHijri({ year: 1448, month: 10, day: 1 }) as string;
const announcement = {
  kind: "confirmation",
  holidayId: "eid-al-fitr",
  hijriYear: 1448,
  date: fitrEstimate,
  announcedAt: "2027-03-08T20:30",
  sourceUrl: "https://www.habous.gov.ma/annonce",
};

describe("POST /v1/contributions", () => {
  it("stores a valid announcement as pending, without the honeypot", async () => {
    const store = createMemoryStore();
    const res = await post(createApi({ contributions: store }), {
      ...announcement,
      contact: "Amina",
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const { data } = await json(res);
    expect(data).toMatchObject({ status: "pending" });

    const [saved] = await store.list("pending");
    expect(saved?.id).toBe(data.id);
    expect(saved?.contribution).toMatchObject({ kind: "confirmation", contact: "Amina" });
    expect(saved?.confirmation).toEqual({
      holidayId: "eid-al-fitr",
      hijriYear: 1448,
      date: fitrEstimate,
      // Ramadan: Morocco is on UTC+0.
      announcedAt: "2027-03-08T20:30:00+00:00",
      sourceUrl: "https://www.habous.gov.ma/annonce",
    });
    // Nothing is live until an admin accepts it.
    expect(await store.liveConfirmations()).toEqual([]);
  });

  it("rejects aggregators and non-official sources", async () => {
    const store = createMemoryStore();
    const app = createApi({ contributions: store });
    for (const sourceUrl of [
      "https://www.timeanddate.com/holidays/morocco/",
      "https://example.com/eid",
    ]) {
      const res = await post(app, { ...announcement, sourceUrl });
      expect(res.status).toBe(422);
      expect((await json(res)).error.code).toBe("invalid_source");
    }
    expect((await store.counts()).pending).toBe(0);
  });

  it("rejects an announced date far from the estimate", async () => {
    const res = await post(createApi({ contributions: createMemoryStore() }), {
      ...announcement,
      date: "2027-04-20",
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error.code).toBe("implausible_date");
  });

  it("validates corrections and the honeypot", async () => {
    const app = createApi({ contributions: createMemoryStore() });
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

  it("returns 503 when no store is configured", async () => {
    const res = await post(createApi(), announcement);
    expect(res.status).toBe(503);
    expect((await json(res)).error.code).toBe("contributions_disabled");
  });

  it("is not part of the public OpenAPI spec", async () => {
    const spec = await json(await createApi().request("/api/openapi.json"));
    expect(Object.keys(spec.paths)).not.toContain("/api/v1/contributions");
  });
});

describe("admin decisions", () => {
  async function pendingAnnouncement() {
    const store = createMemoryStore();
    await post(createApi({ contributions: store }), announcement);
    const [item] = await store.list("pending");
    return { store, id: item?.id as string };
  }

  it("accepting an announcement makes it live in the API at once", async () => {
    const { store, id } = await pendingAnnouncement();
    const accepted = await store.decide(id, "accepted", "Piipas", "Checked on habous.gov.ma");
    expect(accepted).toMatchObject({ status: "accepted", decidedBy: "Piipas" });

    const api = createApi({
      core: async () =>
        createCore(
          withConfirmations(
            dataset,
            (await store.liveConfirmations()).map((l) => l.confirmation),
          ),
        ),
    });
    const { data } = await json(await api.request("/api/v1/holidays?year=2027&calendar=religious"));
    expect(data.find((h: { id: string }) => h.id === "eid-al-fitr")).toMatchObject({
      status: "confirmed",
      dateSource: { kind: "habous-announcement", url: "https://www.habous.gov.ma/annonce" },
    });
  });

  it("rejecting keeps the data unchanged; decisions are final", async () => {
    const { store, id } = await pendingAnnouncement();
    await store.decide(id, "rejected", "Piipas");
    expect(await store.liveConfirmations()).toEqual([]);
    await expect(store.decide(id, "accepted", "Piipas")).rejects.toMatchObject({
      code: "not_pending",
    });
  });

  it("refuses a second confirmation of the same holiday until the first is reverted", async () => {
    const { store, id } = await pendingAnnouncement();
    await store.decide(id, "accepted", "Piipas");
    await post(createApi({ contributions: store }), announcement);
    const [second] = await store.list("pending");
    await expect(store.decide(second?.id as string, "accepted", "Piipas")).rejects.toBeInstanceOf(
      StoreError,
    );

    const reverted = await store.revert(id, "Piipas");
    expect(reverted.status).toBe("rejected");
    expect(await store.liveConfirmations()).toEqual([]);
    await store.decide(second?.id as string, "accepted", "Piipas");
    expect(await store.liveConfirmations()).toHaveLength(1);
  });
});

describe("admin sessions", () => {
  const secret = "x".repeat(40);

  it("round-trips a signed session and rejects tampering and expiry", async () => {
    const cookie = await signSession("Piipas", secret, 0);
    expect(await verifySession(cookie, secret, 1000)).toBe("Piipas");
    expect(await verifySession(cookie.replace("Piipas", "Intruder"), secret, 1000)).toBeNull();
    expect(await verifySession(cookie, "y".repeat(40), 1000)).toBeNull();
    expect(await verifySession(cookie, secret, 9 * 60 * 60 * 1000)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
  });

  it("only allows listed GitHub accounts, and the dev account only in development", () => {
    const env = { ADMIN_GITHUB_USERS: "Piipas, other", NODE_ENV: "production" };
    expect(isAllowed("piipas", env)).toBe(true);
    expect(isAllowed("someone", env)).toBe(false);
    expect(isAllowed("dev", env)).toBe(false);
    expect(isAllowed("dev", { NODE_ENV: "development" })).toBe(true);
  });
});

describe("helpers", () => {
  it("adds Morocco's UTC offset to announcement times", () => {
    expect(moroccoOffsetIso("2026-07-01T21:00")).toBe("2026-07-01T21:00:00+01:00");
  });
});
