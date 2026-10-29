import type { Core, HolidayOccurrence, Locale } from "@3otla/core";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { DOCS_URL } from "./errors";
import type { Holiday, Meta } from "./schemas";

export interface ApiContext {
  /** Clock, injectable for tests. */
  now: () => Date;
  /** Site origin for links, without trailing slash. */
  baseUrl: string;
  /** Changes on every deploy (git SHA on Vercel). */
  dataVersion: string;
  /** Repository data plus live accepted announcements (src/lib/live-data.ts). */
  core: () => Promise<Core>;
}

export type ApiApp = OpenAPIHono;

export function meta(ctx: ApiContext): Meta {
  return {
    dataVersion: ctx.dataVersion,
    license: "CC-BY-4.0",
    attribution: "Data: 3otla — Moroccan holidays (CC BY 4.0)",
    docs: `${ctx.baseUrl}${DOCS_URL}`,
  };
}

export function toHoliday(
  occ: HolidayOccurrence,
  lang: Locale | undefined,
  ctx: ApiContext,
): Holiday {
  return {
    key: occ.key,
    id: occ.id,
    calendar: occ.calendar,
    type: occ.type,
    ...(lang ? { name: occ.labels[lang] } : { labels: occ.labels }),
    date: occ.date,
    endDate: occ.endDate,
    durationDays: occ.durationDays,
    status: occ.status,
    ...(occ.confirmedAt ? { confirmedAt: occ.confirmedAt } : {}),
    ...(occ.hijri ? { hijri: occ.hijri } : {}),
    sourceUrl: occ.sourceUrl,
    ...(occ.decisionRefs ? { decisionRefs: occ.decisionRefs.map((d) => ({ ...d })) } : {}),
    dateSource: occ.dateSource,
    url: `${ctx.baseUrl}/${lang ?? "fr"}/${occ.date.slice(0, 4)}/${occ.id}`,
  };
}

/** `calendar=all` means no filter. */
export const calendarsFor = (calendar: "all" | "national" | "religious") =>
  calendar === "all" ? undefined : [calendar];
