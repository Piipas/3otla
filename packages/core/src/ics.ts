/**
 * iCalendar (RFC 5545) feed generation for subscribable calendars.
 *
 * UIDs are derived from the occurrence key, which does not change when an estimated
 * date is confirmed, so calendar apps update the event in place. SEQUENCE is bumped
 * on confirmation so clients accept the new date.
 */
import { addDays } from "./date";
import type {
  CalendarId,
  HolidayOccurrence,
  Labels,
  Locale,
  SchoolCalendarId,
  Status,
} from "./types";

export interface IcsOptions {
  lang: Locale;
  fromYear: number;
  toYear: number;
  /** Site origin used for event URLs, e.g. "https://3otla.ma". */
  baseUrl: string;
  /** DTSTAMP. Inject for deterministic output (tests). */
  now?: Date;
}

export type FeedId = CalendarId | SchoolCalendarId | "all";

/** Anything with a date range, a status and a page on the site. */
export type IcsItem = Pick<
  HolidayOccurrence,
  "key" | "labels" | "date" | "endDate" | "status" | "sourceUrl" | "dateSource" | "confirmedAt"
> & {
  /** Page path without the locale prefix, e.g. "/2027/eid-al-adha". */
  path: string;
};

const CALENDAR_NAMES: Record<FeedId, Labels> = {
  national: {
    ar: "العطل الوطنية بالمغرب",
    fr: "Jours fériés nationaux au Maroc",
    en: "Morocco national holidays",
  },
  religious: {
    ar: "الأعياد الدينية بالمغرب",
    fr: "Fêtes religieuses au Maroc",
    en: "Morocco religious holidays",
  },
  all: {
    ar: "العطل الرسمية بالمغرب",
    fr: "Jours fériés au Maroc",
    en: "Morocco public holidays",
  },
  "school-public": {
    ar: "العطل المدرسية بالمغرب (التعليم العمومي)",
    fr: "Vacances scolaires au Maroc (enseignement public)",
    en: "Morocco school holidays (public schools)",
  },
};

const STATUS_TEXT: Record<Status, Labels> = {
  fixed: { ar: "تاريخ ثابت.", fr: "Date fixe.", en: "Fixed date." },
  estimated: {
    ar: "تاريخ تقديري (تقويم أم القرى). قد يتأخر بيوم حسب رؤية الهلال بالمغرب.",
    fr: "Date estimée (calendrier Umm al-Qura). Peut être décalée d’un jour selon l’observation du croissant au Maroc.",
    en: "Estimated date (Umm al-Qura calendar). May shift by one day depending on moon sighting in Morocco.",
  },
  confirmed: {
    ar: "تاريخ مؤكد رسميا.",
    fr: "Date confirmée officiellement.",
    en: "Officially confirmed date.",
  },
};

const ESTIMATED_SUFFIX: Labels = { ar: "تاريخ تقديري", fr: "date estimée", en: "estimated" };
const SOURCE_LABEL: Labels = { ar: "المصدر", fr: "Source", en: "Source" };

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function utf8Length(char: string): number {
  const cp = char.codePointAt(0) ?? 0;
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/** Folds a content line to at most 75 octets per physical line, never splitting a character. */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const len = utf8Length(char);
    if (bytes + len > 75) {
      out.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += len;
  }
  out.push(current);
  return out.join("\r\n");
}

const icsDate = (date: string) => date.replace(/-/g, "");
const icsDateTime = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function eventLines(occ: IcsItem, options: IcsBuildOptions, stamp: string): string[] {
  const { lang, baseUrl } = options;
  const name = occ.labels[lang];
  const summary = occ.status === "estimated" ? `${name} (${ESTIMATED_SUFFIX[lang]})` : name;
  const dateSourceUrl = occ.dateSource.kind === "habous-announcement" ? occ.dateSource.url : null;
  const url = `${baseUrl}/${lang}${occ.path}`;
  const description = [
    STATUS_TEXT[occ.status][lang],
    `${SOURCE_LABEL[lang]}: ${dateSourceUrl ?? occ.sourceUrl}`,
    url,
  ].join("\n");

  const lines = [
    "BEGIN:VEVENT",
    `UID:${occ.key.replaceAll(":", "-")}@3otla`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(occ.date)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(occ.endDate, 1))}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${url}`,
    `STATUS:${occ.status === "estimated" ? "TENTATIVE" : "CONFIRMED"}`,
    `SEQUENCE:${occ.status === "confirmed" ? 1 : 0}`,
  ];
  if (occ.confirmedAt) lines.push(`LAST-MODIFIED:${icsDateTime(new Date(occ.confirmedAt))}`);
  lines.push("TRANSP:TRANSPARENT", "CLASS:PUBLIC", "END:VEVENT");
  return lines;
}

export type IcsBuildOptions = Pick<IcsOptions, "lang" | "baseUrl" | "now">;

export function buildIcs(
  feed: FeedId,
  items: readonly IcsItem[],
  options: IcsBuildOptions,
): string {
  const stamp = icsDateTime(options.now ?? new Date());
  const name = CALENDAR_NAMES[feed][options.lang];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//3otla//Moroccan Holidays//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `NAME:${escapeText(name)}`,
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:Africa/Casablanca",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    ...items.flatMap((item) => eventLines(item, options, stamp)),
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
