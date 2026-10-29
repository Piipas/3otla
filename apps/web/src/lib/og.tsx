import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { diffDays, type HolidayOccurrence, todayInCasablanca } from "@3otla/core";
import { ImageResponse } from "next/og";
import type { AppLocale } from "@/i18n/routing";
import { hasArabic, toVisual } from "./arabic-shaping";
import { formatHijri, formatOccurrenceDates } from "./format";

export const OG_SIZE = { width: 1200, height: 630 };

const FONT_DIR = join(process.cwd(), "assets/fonts");

async function fonts() {
  const load = (file: string) => readFile(join(FONT_DIR, file));
  const [arabic400, arabic700, latin400, latin700] = await Promise.all([
    load("readex-pro-arabic-400-normal.woff"),
    load("readex-pro-arabic-700-normal.woff"),
    load("readex-pro-latin-400-normal.woff"),
    load("readex-pro-latin-700-normal.woff"),
  ]);
  return [
    { name: "Readex", data: latin400, weight: 400 as const, style: "normal" as const },
    { name: "Readex", data: latin700, weight: 700 as const, style: "normal" as const },
    { name: "Readex", data: arabic400, weight: 400 as const, style: "normal" as const },
    { name: "Readex", data: arabic700, weight: 700 as const, style: "normal" as const },
  ];
}

const COLORS = {
  fixed: { bg: "#e4ddd0", fg: "#3b3a36" },
  estimated: { bg: "#f7e3b8", fg: "#8a5800" },
  confirmed: { bg: "#cdebdc", fg: "#11704f" },
} as const;

export interface OgText {
  kicker: string;
  status: string;
  inDays: (count: number) => string;
  site: string;
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="6" y="6" width="20" height="20" rx="2" fill={color} />
      <rect x="6" y="6" width="20" height="20" rx="2" fill={color} transform="rotate(45 16 16)" />
    </svg>
  );
}

/** Share card: holiday name, dates, status and days remaining, in the page's language. */
export async function holidayOgImage(
  occ: HolidayOccurrence,
  locale: AppLocale,
  text: OgText,
): Promise<ImageResponse> {
  const rtl = locale === "ar";
  const days = diffDays(todayInCasablanca(), occ.date);
  const status = COLORS[occ.status];
  const align = rtl ? "flex-end" : "flex-start";
  // Satori does not shape or reorder Arabic, so every string goes through toVisual.
  const v = (s: string) => (hasArabic(s) ? toVisual(s, rtl ? "rtl" : "ltr") : s);
  const name = v(occ.labels[locale]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: align,
        padding: "64px 72px",
        background: "linear-gradient(135deg, #2f3fce 0%, #1b2486 100%)",
        color: "white",
        fontFamily: "Readex",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: rtl ? "row-reverse" : "row",
          alignItems: "center",
          gap: 14,
          fontSize: 30,
          opacity: 0.85,
        }}
      >
        <Star size={36} color="#f4eee3" />
        <span>{v(text.site)}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 18 }}>
        <span style={{ fontSize: 28, opacity: 0.75 }}>{v(text.kicker)}</span>
        <span style={{ fontSize: name.length > 22 ? 72 : 92, fontWeight: 700, lineHeight: 1.1 }}>
          {name}
        </span>
        <span style={{ fontSize: 38, opacity: 0.9 }}>{v(formatOccurrenceDates(occ, locale))}</span>
        {occ.hijri ? (
          <span style={{ fontSize: 28, opacity: 0.65 }}>{v(formatHijri(occ.hijri, locale))}</span>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: rtl ? "row-reverse" : "row",
          alignItems: "center",
          gap: 20,
        }}
      >
        <span
          style={{
            display: "flex",
            padding: "10px 24px",
            borderRadius: 999,
            fontSize: 28,
            fontWeight: 700,
            background: status.bg,
            color: status.fg,
          }}
        >
          {v(text.status)}
        </span>
        {days >= 0 ? (
          <span
            style={{
              display: "flex",
              padding: "10px 24px",
              borderRadius: 999,
              fontSize: 28,
              background: "rgba(255,255,255,0.14)",
            }}
          >
            {v(text.inDays(days))}
          </span>
        ) : null}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await fonts() },
  );
}
