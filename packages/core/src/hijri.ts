/**
 * Hijri conversion using the Umm al-Qura calendar shipped with ICU (Intl).
 *
 * Morocco fixes religious holidays by local moon sighting, which can land one day
 * after Umm al-Qura. Everything computed here is therefore an *estimate*; official
 * dates come from confirmations.json.
 */
import { addDays, fromDayNumber, type IsoDate, toDayNumber } from "./date";
import type { Labels } from "./types";

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

export const HIJRI_MONTHS: readonly Labels[] = [
  { ar: "محرم", fr: "Mouharram", en: "Muharram" },
  { ar: "صفر", fr: "Safar", en: "Safar" },
  { ar: "ربيع الأول", fr: "Rabia al-Awal", en: "Rabi’ al-Awwal" },
  { ar: "ربيع الآخر", fr: "Rabia ath-Thani", en: "Rabi’ al-Thani" },
  { ar: "جمادى الأولى", fr: "Joumada al-Oula", en: "Jumada al-Ula" },
  { ar: "جمادى الآخرة", fr: "Joumada ath-Thania", en: "Jumada al-Akhirah" },
  { ar: "رجب", fr: "Rajab", en: "Rajab" },
  { ar: "شعبان", fr: "Chaabane", en: "Sha’ban" },
  { ar: "رمضان", fr: "Ramadan", en: "Ramadan" },
  { ar: "شوال", fr: "Chawwal", en: "Shawwal" },
  { ar: "ذو القعدة", fr: "Dhou al-Qi’da", en: "Dhu al-Qa’dah" },
  { ar: "ذو الحجة", fr: "Dhou al-Hijja", en: "Dhu al-Hijjah" },
];

const umalqura = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const toHijriCache = new Map<IsoDate, HijriDate>();

/** Umm al-Qura Hijri date for a Gregorian date. */
export function gregorianToHijri(date: IsoDate): HijriDate {
  const cached = toHijriCache.get(date);
  if (cached) return cached;
  const parts = umalqura.formatToParts(new Date(toDayNumber(date) * 86_400_000));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const hijri = { year: get("year"), month: get("month"), day: get("day") };
  toHijriCache.set(date, hijri);
  return hijri;
}

// 1 Muharram 1 AH ≈ 622-07-19 (proleptic Gregorian). Mean lengths are only used to get
// within a few days of the answer; the exact date is then found by searching around it.
const HIJRI_EPOCH_DAY = toDayNumber("0622-07-19");
const MEAN_YEAR = 354.36667;
const MEAN_MONTH = 29.530589;
const SEARCH_RADIUS = 6;

const fromHijriCache = new Map<string, IsoDate | null>();

/** Gregorian date of a Umm al-Qura Hijri date, or null if that day does not exist (e.g. 30th of a 29-day month). */
export function hijriToGregorian({ year, month, day }: HijriDate): IsoDate | null {
  const key = `${year}-${month}-${day}`;
  const cached = fromHijriCache.get(key);
  if (cached !== undefined) return cached;

  const approx = fromDayNumber(
    HIJRI_EPOCH_DAY + Math.floor((year - 1) * MEAN_YEAR + (month - 1) * MEAN_MONTH + day - 1),
  );
  let result: IsoDate | null = null;
  for (let offset = -SEARCH_RADIUS; offset <= SEARCH_RADIUS; offset++) {
    const candidate = addDays(approx, offset);
    const h = gregorianToHijri(candidate);
    if (h.year === year && h.month === month && h.day === day) {
      result = candidate;
      break;
    }
  }
  fromHijriCache.set(key, result);
  return result;
}
