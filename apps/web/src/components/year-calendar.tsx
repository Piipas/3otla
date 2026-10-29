import {
  addDays,
  dayOfWeek,
  type HolidayOccurrence,
  type IsoDate,
  isWeekend,
  resolveHolidays,
} from "@3otla/core";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatDate, monthName, weekdayNames } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TodayMarker } from "./motion";

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const STATUS_CELL = {
  fixed: "bg-fixed text-bg hover:brightness-125",
  estimated:
    "border border-dashed border-estimated/70 bg-estimated-soft text-estimated hover:border-estimated",
  confirmed: "bg-confirmed text-bg hover:brightness-110",
} as const;

/** Twelve month grids, Monday first. Holiday days link to their page. */
export function YearCalendar({ year }: { year: number }) {
  const locale = useLocale() as AppLocale;
  const byDate = new Map<IsoDate, HolidayOccurrence[]>();
  for (const occ of resolveHolidays(year)) {
    for (let i = 0; i < occ.durationDays; i++) {
      const d = addDays(occ.date, i);
      byDate.set(d, [...(byDate.get(d) ?? []), occ]);
    }
  }
  const weekdays = weekdayNames(locale);

  return (
    <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <TodayMarker />
      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
        const first = `${year}-${pad(month)}-01`;
        const leading = (dayOfWeek(first) + 6) % 7;
        const count = daysInMonth(year, month);
        return (
          <section key={month} aria-labelledby={`m-${month}`} className="min-w-0">
            <h3 id={`m-${month}`} className="mb-3 text-sm font-semibold capitalize">
              {monthName(month, locale)}
            </h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {weekdays.map((w) => (
                <span key={w} className="pb-1 text-[0.65rem] text-muted" aria-hidden="true">
                  {w}
                </span>
              ))}
              {Array.from({ length: leading }, (_, k) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static padding cells
                <span key={`pad-${k}`} aria-hidden="true" />
              ))}
              {Array.from({ length: count }, (_, k) => {
                const date = `${year}-${pad(month)}-${pad(k + 1)}`;
                const holidays = byDate.get(date);
                const base =
                  "flex aspect-square items-center justify-center rounded-md tabular-nums transition data-[today=true]:ring-2 data-[today=true]:ring-accent data-[today=true]:ring-offset-1 data-[today=true]:ring-offset-bg";
                const first = holidays?.[0];
                if (first) {
                  const label = `${holidays.map((h) => h.labels[locale]).join(", ")} — ${formatDate(date, locale)}`;
                  return (
                    <Link
                      key={date}
                      href={`/${first.date.slice(0, 4)}/${first.id}`}
                      data-date={date}
                      data-status={first.status}
                      aria-label={label}
                      title={label}
                      className={cn(base, "font-semibold", STATUS_CELL[first.status])}
                    >
                      {k + 1}
                    </Link>
                  );
                }
                return (
                  <span
                    key={date}
                    data-date={date}
                    className={cn(
                      base,
                      isWeekend(date) ? "bg-weekend/60 text-muted" : "text-ink/80",
                    )}
                  >
                    {k + 1}
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function CalendarLegend({
  labels,
}: {
  labels: { fixed: string; estimated: string; confirmed: string; weekend: string; today: string };
}) {
  const swatch = "inline-block size-4 rounded";
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
      <li className="flex items-center gap-2">
        <span className={cn(swatch, STATUS_CELL.fixed)} />
        {labels.fixed}
      </li>
      <li className="flex items-center gap-2">
        <span className={cn(swatch, STATUS_CELL.estimated)} />
        {labels.estimated}
      </li>
      <li className="flex items-center gap-2">
        <span className={cn(swatch, STATUS_CELL.confirmed)} />
        {labels.confirmed}
      </li>
      <li className="flex items-center gap-2">
        <span className={cn(swatch, "bg-weekend")} />
        {labels.weekend}
      </li>
      <li className="flex items-center gap-2">
        <span className={cn(swatch, "ring-2 ring-accent")} />
        {labels.today}
      </li>
    </ul>
  );
}
