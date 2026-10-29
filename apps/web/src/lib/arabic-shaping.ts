/**
 * Minimal Arabic shaping + bidi reordering for the OG image renderer (Satori), which lays
 * text out left-to-right and does not join Arabic letters.
 *
 * - Letters become their contextual presentation forms (U+FE70–FEFF), lam-alef becomes
 *   a ligature.
 * - Runs are reordered visually: Arabic runs reversed, digits/Latin kept in order, and in
 *   an RTL paragraph the run order itself is reversed.
 *
 * Only used for images. Real pages rely on the browser's shaping.
 */

// [isolated, final, initial?, medial?]. Two forms = right-joining (does not join to the next letter).
const FORMS: Record<string, readonly number[]> = {
  "\u0621": [0xfe80],
  "\u0622": [0xfe81, 0xfe82],
  "\u0623": [0xfe83, 0xfe84],
  "\u0624": [0xfe85, 0xfe86],
  "\u0625": [0xfe87, 0xfe88],
  "\u0626": [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c],
  "\u0627": [0xfe8d, 0xfe8e],
  "\u0628": [0xfe8f, 0xfe90, 0xfe91, 0xfe92],
  "\u0629": [0xfe93, 0xfe94],
  "\u062a": [0xfe95, 0xfe96, 0xfe97, 0xfe98],
  "\u062b": [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c],
  "\u062c": [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0],
  "\u062d": [0xfea1, 0xfea2, 0xfea3, 0xfea4],
  "\u062e": [0xfea5, 0xfea6, 0xfea7, 0xfea8],
  "\u062f": [0xfea9, 0xfeaa],
  "\u0630": [0xfeab, 0xfeac],
  "\u0631": [0xfead, 0xfeae],
  "\u0632": [0xfeaf, 0xfeb0],
  "\u0633": [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4],
  "\u0634": [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8],
  "\u0635": [0xfeb9, 0xfeba, 0xfebb, 0xfebc],
  "\u0636": [0xfebd, 0xfebe, 0xfebf, 0xfec0],
  "\u0637": [0xfec1, 0xfec2, 0xfec3, 0xfec4],
  "\u0638": [0xfec5, 0xfec6, 0xfec7, 0xfec8],
  "\u0639": [0xfec9, 0xfeca, 0xfecb, 0xfecc],
  "\u063a": [0xfecd, 0xfece, 0xfecf, 0xfed0],
  "\u0641": [0xfed1, 0xfed2, 0xfed3, 0xfed4],
  "\u0642": [0xfed5, 0xfed6, 0xfed7, 0xfed8],
  "\u0643": [0xfed9, 0xfeda, 0xfedb, 0xfedc],
  "\u0644": [0xfedd, 0xfede, 0xfedf, 0xfee0],
  "\u0645": [0xfee1, 0xfee2, 0xfee3, 0xfee4],
  "\u0646": [0xfee5, 0xfee6, 0xfee7, 0xfee8],
  "\u0647": [0xfee9, 0xfeea, 0xfeeb, 0xfeec],
  "\u0648": [0xfeed, 0xfeee],
  "\u0649": [0xfeef, 0xfef0],
  "\u064a": [0xfef1, 0xfef2, 0xfef3, 0xfef4],
};

// Lam + alef variant → [isolated, final] ligature.
const LAM_ALEF: Record<string, readonly [number, number]> = {
  "\u0622": [0xfef5, 0xfef6],
  "\u0623": [0xfef7, 0xfef8],
  "\u0625": [0xfef9, 0xfefa],
  "\u0627": [0xfefb, 0xfefc],
};

const LAM = "\u0644";
const ARABIC_COMMA = String.fromCharCode(0x060c);
const TATWEEL = "\u0640";
/** Harakat and other marks: transparent for joining; dropped because Satori can't position them. */
const MARKS = /[\u064b-\u065f\u0670\u06d6-\u06ed]/g;
/** Bidi control characters some Intl formats insert. */
const BIDI_CONTROLS = /[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g;

const joinsNext = (ch: string | undefined) =>
  ch === TATWEEL || (ch !== undefined && (FORMS[ch]?.length ?? 0) === 4);
const isLetter = (ch: string | undefined) => ch === TATWEEL || (ch !== undefined && ch in FORMS);

/** Replaces Arabic letters with contextual presentation forms (logical order is kept). */
export function shapeArabic(input: string): string {
  const chars = [...input.replace(MARKS, "")];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] as string;
    // Anything left in the Arabic block makes Satori's font engine apply the font's Arabic
    // lookups, which it cannot parse for Readex Pro. Tatweel only stretches a join (its
    // neighbours already took joining forms) and the Arabic comma becomes a plain comma.
    if (ch === TATWEEL) continue;
    if (ch === ARABIC_COMMA) {
      out += ",";
      continue;
    }
    const forms = FORMS[ch];
    if (!forms) {
      out += ch;
      continue;
    }
    const prevJoins = joinsNext(chars[i - 1]);
    const next = chars[i + 1];
    const ligature = ch === LAM && next !== undefined ? LAM_ALEF[next] : undefined;
    if (ligature) {
      out += String.fromCodePoint(prevJoins ? ligature[1] : ligature[0]);
      i++;
      continue;
    }
    const nextJoins = forms.length === 4 && isLetter(next);
    const form =
      prevJoins && nextJoins ? forms[3] : prevJoins ? forms[1] : nextJoins ? forms[2] : forms[0];
    out += String.fromCodePoint(form ?? (forms[0] as number));
  }
  return out;
}

/** R: Arabic, L: other letters, EN: digits, N: neutral (spaces, punctuation). */
type Kind = "R" | "L" | "EN" | "N";

function classify(ch: string): Kind {
  const cp = ch.codePointAt(0) ?? 0;
  if (
    (cp >= 0x0600 && cp <= 0x06ff) ||
    (cp >= 0xfb50 && cp <= 0xfdff) ||
    (cp >= 0xfe70 && cp <= 0xfeff)
  ) {
    return "R";
  }
  if (/\p{N}/u.test(ch)) return "EN";
  return /\p{L}/u.test(ch) ? "L" : "N";
}

/**
 * Converts logical-order text into the left-to-right visual order Satori draws, following
 * the parts of the Unicode bidi algorithm our strings need:
 * - digits keep their order; they count as L after Latin text, otherwise as R (rules W7, N1),
 *   so "16–17 ماي" in Arabic draws like a browser does (16 on the right);
 * - neutrals take their neighbours' direction when both agree, else the paragraph's (N1, N2).
 */
export function toVisual(input: string, paragraph: "rtl" | "ltr"): string {
  const chars = [...shapeArabic(input.replace(BIDI_CONTROLS, ""))];
  const base = paragraph === "rtl" ? "R" : "L";
  const kinds = chars.map(classify);

  // Direction each strong character or digit exerts on neighbouring neutrals.
  let lastStrong: "R" | "L" = base;
  const strength = kinds.map((k) => {
    if (k === "R" || k === "L") {
      lastStrong = k;
      return k;
    }
    return k === "EN" ? lastStrong : null;
  });

  const nearest = (i: number, step: 1 | -1) => {
    for (let j = i + step; j >= 0 && j < chars.length; j += step) {
      const s = strength[j];
      if (s) return s;
    }
    return base;
  };

  // true = drawn right-to-left (characters reversed).
  const rtl = kinds.map((k, i) => {
    if (k === "R") return true;
    if (k === "L" || k === "EN") return false;
    const before = nearest(i, -1);
    return (before === nearest(i, 1) ? before : base) === "R";
  });

  const runs: { rtl: boolean; text: string }[] = [];
  chars.forEach((ch, i) => {
    const dir = rtl[i] as boolean;
    const last = runs.at(-1);
    if (last && last.rtl === dir) last.text += ch;
    else runs.push({ rtl: dir, text: ch });
  });

  const visualRuns = runs.map((r) => (r.rtl ? [...r.text].reverse().join("") : r.text));
  return (paragraph === "rtl" ? visualRuns.reverse() : visualRuns).join("");
}

export const hasArabic = (s: string) => /[\u0600-\u06ff]/.test(s);
