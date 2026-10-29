import type { HolidayOccurrence } from "@3otla/core";
import { BadgeCheck, CalendarCheck, MoonStar } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STYLES = {
  fixed: "bg-fixed-soft text-fixed",
  estimated: "bg-estimated-soft text-estimated",
  confirmed: "bg-confirmed-soft text-confirmed",
} as const;

const ICONS = { fixed: CalendarCheck, estimated: MoonStar, confirmed: BadgeCheck } as const;

/** Where the badge links: the source that justifies this *date*. */
export function statusHref(occ: HolidayOccurrence, locale: string): string {
  if (occ.dateSource.kind === "habous-announcement") return occ.dateSource.url;
  if (occ.status === "estimated") return `/${locale}/sources#religious`;
  return occ.sourceUrl;
}

export function StatusBadge({
  occurrence,
  size = "sm",
  className,
}: {
  occurrence: HolidayOccurrence;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("status");
  const locale = useLocale();
  const { status } = occurrence;
  const Icon = ICONS[status];
  const href = statusHref(occurrence, locale);
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      title={`${t(`${status}Help`)} — ${t("source")}`}
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-current/15 transition hover:ring-current/40",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        STYLES[status],
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden="true" />
      {t(status)}
    </a>
  );
}
