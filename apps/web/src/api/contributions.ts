/**
 * Public contributions. Git stays the database: a contribution becomes a GitHub issue,
 * maintainers accept or reject it with a label, and a workflow turns accepted
 * confirmations into a data pull request (.github/workflows/contributions.yml).
 *
 * Submissions are checked before they reach GitHub: the source must be on the official
 * allowlist, and an announced religious date must be within ±2 days of the estimate.
 */
import {
  diffDays,
  fromHijri,
  type IsoDate,
  parseIsoDate,
  startOfDayInCasablanca,
} from "@3otla/core";
import { religiousHolidays } from "@3otla/data";
import { checkSourceUrl } from "@3otla/data/sources";
import { z } from "@hono/zod-openapi";

export const CONTRIBUTION_KINDS = ["confirmation", "correction", "school-calendar"] as const;
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

const HIJRI_HOLIDAYS = religiousHolidays.filter((h) => h.type === "hijri");
const hijriIds = HIJRI_HOLIDAYS.map((h) => h.id) as [string, ...string[]];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((v) => {
    try {
      parseIsoDate(v);
      return true;
    } catch {
      return false;
    }
  }, "Not a valid date");
const text = (max: number) => z.string().trim().max(max);

const common = {
  sourceUrl: z.string().trim().url().max(500),
  /** Optional name or GitHub handle. Published with the issue. */
  contact: text(100).optional(),
  /** Honeypot: hidden in the form, only bots fill it. */
  website: z.string().max(0).optional(),
};

export const ContributionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("confirmation"),
    holidayId: z.enum(hijriIds),
    hijriYear: z.number().int().min(1440).max(1600),
    date: isoDate,
    /** Date and time of the announcement, Morocco local time ("2027-03-08T20:30"). */
    announcedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    details: text(1000).optional(),
    ...common,
  }),
  z.object({
    kind: z.literal("correction"),
    subject: text(120).min(3),
    proposedDate: isoDate.optional(),
    details: text(2000).min(20),
    ...common,
  }),
  z.object({
    kind: z.literal("school-calendar"),
    schoolYear: z.string().regex(/^\d{4}-\d{4}$/),
    details: text(2000).optional(),
    ...common,
  }),
]);

export type Contribution = z.infer<typeof ContributionSchema>;

/** A confirmation as it will be written to packages/data/confirmations.json. */
export interface ConfirmationEntry {
  holidayId: string;
  hijriYear: number;
  date: IsoDate;
  announcedAt: string;
  sourceUrl: string;
}

export type CheckResult =
  | { ok: true; confirmation?: ConfirmationEntry }
  | { ok: false; code: "invalid_source" | "implausible_date"; message: string };

/** "2027-03-08T20:30" in Morocco → "2027-03-08T20:30:00+01:00". */
export function moroccoOffsetIso(local: string): string {
  const day = local.slice(0, 10);
  const offsetMin =
    (Date.parse(`${day}T00:00:00Z`) - startOfDayInCasablanca(day).getTime()) / 60000;
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${local}:00${sign}${hh}:${mm}`;
}

/** Rules that need the data, beyond the request schema. */
export function checkContribution(c: Contribution): CheckResult {
  const source = checkSourceUrl(c.sourceUrl);
  if (!source.ok) {
    return {
      ok: false,
      code: "invalid_source",
      message: `sourceUrl rejected: ${source.reason}. Use an official source (maroc.ma, *.gov.ma, MAP).`,
    };
  }
  if (c.kind !== "confirmation") return { ok: true };

  const def = HIJRI_HOLIDAYS.find((h) => h.id === c.holidayId);
  const estimate = def && fromHijri({ year: c.hijriYear, month: def.month, day: def.day });
  if (!estimate || Math.abs(diffDays(estimate, c.date)) > 2) {
    return {
      ok: false,
      code: "implausible_date",
      message: `${c.date} is more than 2 days away from the estimate${estimate ? ` (${estimate})` : ""} for ${c.holidayId} ${c.hijriYear}.`,
    };
  }
  return {
    ok: true,
    confirmation: {
      holidayId: c.holidayId,
      hijriYear: c.hijriYear,
      date: c.date,
      announcedAt: moroccoOffsetIso(c.announcedAt),
      sourceUrl: c.sourceUrl,
    },
  };
}

export interface IssueDraft {
  title: string;
  body: string;
  labels: string[];
}

/** Marker the moderation workflow looks for. */
export const PAYLOAD_MARKER = "3otla-contribution";

/** Free text goes in a fenced block: no mentions, links or issue references are triggered. */
const fenced = (value: string) => `~~~text\n${value.replaceAll("~~~", "~ ~ ~")}\n~~~`;

export function issueFor(c: Contribution, check: Extract<CheckResult, { ok: true }>): IssueDraft {
  const rows: [string, string][] = [];
  let title: string;
  switch (c.kind) {
    case "confirmation":
      title = `Confirmation: ${c.holidayId} ${c.hijriYear} on ${c.date}`;
      rows.push(
        ["Holiday", `\`${c.holidayId}\``],
        ["Hijri year", String(c.hijriYear)],
        ["Announced date", c.date],
        ["Announced at", check.confirmation?.announcedAt ?? c.announcedAt],
      );
      break;
    case "correction":
      title = `Correction: ${c.subject.replace(/\s+/g, " ").slice(0, 80)}`;
      if (c.proposedDate) rows.push(["Proposed date", c.proposedDate]);
      break;
    case "school-calendar":
      title = `School calendar ${c.schoolYear}`;
      rows.push(["School year", c.schoolYear]);
      break;
  }
  rows.push(["Source", `<${c.sourceUrl}> (official allowlist ✓)`]);

  const payload = {
    version: 1,
    ...c,
    website: undefined,
    ...(check.confirmation ? { confirmation: check.confirmation } : {}),
  };
  const body = [
    `**Kind:** \`${c.kind}\``,
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map(([k, v]) => `| ${k} | ${v.replaceAll("|", "\\|")} |`),
    "",
    ...(c.kind === "correction" ? ["**Subject**", fenced(c.subject), ""] : []),
    ...(c.details ? ["**Details**", fenced(c.details), ""] : []),
    ...(c.contact ? ["**Submitted by**", fenced(c.contact), ""] : []),
    "---",
    "Maintainers: check the source, then add the `accepted` label to apply this contribution, or `rejected` to decline it.",
    c.kind === "confirmation"
      ? "Accepting opens a pull request that adds the confirmation to `packages/data/confirmations.json`."
      : "Accepting marks it for a manual data change (see CONTRIBUTING.md).",
    "",
    // JSON escapes "<" so the payload can never close the HTML comment early.
    `<!-- ${PAYLOAD_MARKER}\n${JSON.stringify(payload, null, 2).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")}\n-->`,
  ].join("\n");

  return { title, body, labels: ["contribution", `kind:${c.kind}`] };
}

/** Where accepted contributions land. Injected so tests never call GitHub. */
export interface ContributionSink {
  create(issue: IssueDraft): Promise<{ number: number; url: string }>;
}

type Env = Record<string, string | undefined>;

/** GitHub issues sink, or null when no token is configured (contributions disabled). */
export function githubSinkFromEnv(
  env: Env,
  fetchImpl: typeof fetch = fetch,
): ContributionSink | null {
  const token = env.GITHUB_CONTRIBUTIONS_TOKEN;
  const repo = env.GITHUB_CONTRIBUTIONS_REPO || "Piipas/3otla";
  if (!token) return null;
  return {
    async create(issue) {
      const res = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "3otla-contributions",
        },
        body: JSON.stringify(issue),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`GitHub issue creation failed: ${res.status}`);
      const json = (await res.json()) as { number: number; html_url: string };
      return { number: json.number, url: json.html_url };
    },
  };
}
