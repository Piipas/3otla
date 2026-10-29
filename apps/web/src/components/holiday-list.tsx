import { diffDays, type HolidayOccurrence, type IsoDate } from "@3otla/core";
import { ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatDate, formatOccurrenceDates } from "@/lib/format";
import { StatusBadge } from "./status-badge";

/** Holidays as rows: a date tile, the name, dates, duration and status. */
export function HolidayList({
  holidays,
  today,
}: {
  holidays: HolidayOccurrence[];
  /** When set, shows "in N days" relative to this date. */
  today?: IsoDate;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations();
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {holidays.map((occ) => {
        const href = `/${occ.date.slice(0, 4)}/${occ.id}`;
        return (
          <li
            key={occ.key}
            className="group relative flex items-center gap-4 p-4 transition hover:bg-surface-2/60 sm:gap-5 sm:p-5"
          >
            <div className="flex w-14 shrink-0 flex-col items-center rounded-arch bg-surface-2 px-1 pt-3 pb-2 text-center ring-1 ring-line">
              <span className="text-2xl leading-none font-semibold tabular-nums">
                {Number(occ.date.slice(8))}
              </span>
              <span className="mt-1 text-[0.7rem] text-muted">
                {formatDate(occ.date, locale, { month: "short" })}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">
                <Link href={href} className="after:absolute after:inset-0 hover:text-brand">
                  {occ.labels[locale]}
                </Link>
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                {formatOccurrenceDates(occ, locale)}
                {occ.durationDays > 1 ? ` · ${t("holiday.days", { count: occ.durationDays })}` : ""}
                {today
                  ? ` · ${t("holiday.inDays", { count: Math.max(0, diffDays(today, occ.date)) })}`
                  : ""}
              </p>
            </div>
            <StatusBadge occurrence={occ} className="relative z-10 hidden sm:inline-flex" />
            <ArrowUpRight
              aria-hidden="true"
              className="size-4 shrink-0 text-muted transition group-hover:text-brand rtl:-scale-x-100"
            />
          </li>
        );
      })}
    </ol>
  );
}
