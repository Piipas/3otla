import { fromHijri } from "@3otla/core";
import { religiousHolidays } from "@3otla/data";
import { Check, ExternalLink, LogIn, LogOut, Undo2, X } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { type AppLocale, INTL_LOCALE } from "@/i18n/routing";
import { decideContribution } from "@/lib/admin-actions";
import { currentAdmin } from "@/lib/admin-session";
import {
  type ContributionStatus,
  STATUSES,
  type StoredContribution,
  storeFromEnv,
} from "@/lib/contribution-store";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Reads the session cookie and live contributions on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

type Params = Promise<{ locale: AppLocale }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const ERRORS = [
  "forbidden",
  "oauth",
  "not_configured",
  "store",
  "already_confirmed",
  "not_pending",
  "not_accepted",
  "not_found",
  "generic",
] as const;
const DONE = ["accepted", "rejected", "revert"] as const;

const one = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const search = await searchParams;
  const error = one(search.error, ERRORS);
  const done = one(search.done, DONE);
  const admin = await currentAdmin();

  if (!admin) {
    return (
      <div className="mx-auto max-w-md pt-16">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-semibold">{t("signInTitle")}</h1>
          <p className="mt-2 text-muted">{t("signInBody")}</p>
          {error ? <Notice tone="error">{t(`errors.${error}`)}</Notice> : null}
          <a
            href={`/api/admin/login?locale=${locale}`}
            className={cn(buttonVariants({ size: "lg" }), "mt-6")}
          >
            <LogIn className="rtl:-scale-x-100" aria-hidden="true" />
            {t("signIn")}
          </a>
        </Card>
      </div>
    );
  }

  const tab = one(search.status, STATUSES) ?? "pending";
  const store = storeFromEnv(process.env);
  const [counts, items] = store
    ? await Promise.all([store.counts(), store.list(tab)])
    : [{ pending: 0, accepted: 0, rejected: 0 }, []];

  return (
    <div className="pt-10 sm:pt-14">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="me-auto text-4xl font-semibold">{t("title")}</h1>
        <span className="text-sm text-muted">{t("signedInAs", { login: admin })}</span>
        <form action="/api/admin/logout" method="post">
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <LogOut className="rtl:-scale-x-100" aria-hidden="true" />
            {t("signOut")}
          </button>
        </form>
      </div>

      {!store ? <Notice tone="error">{t("errors.store")}</Notice> : null}
      {error ? <Notice tone="error">{t(`errors.${error}`)}</Notice> : null}
      {done ? <Notice tone="ok">{t(`done.${done}`)}</Notice> : null}

      <nav aria-label={t("title")} className="mt-8 flex flex-wrap gap-2 border-b border-line pb-3">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin?status=${s}`}
            aria-current={s === tab ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium",
              s === tab
                ? "bg-brand text-brand-ink"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {t(`tabs.${s}`)}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs tabular-nums",
                s === tab ? "bg-white/20" : "bg-surface-2",
              )}
            >
              {counts[s]}
            </span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-muted">{t("empty")}</p>
      ) : (
        <ol className="mt-6 space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <ContributionCard item={item} tab={tab} locale={locale} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mt-6 rounded-lg border p-3 text-sm font-medium",
        tone === "ok"
          ? "border-confirmed/30 bg-confirmed-soft/50 text-confirmed"
          : "border-accent/40 bg-accent/5 text-accent",
      )}
    >
      {children}
    </p>
  );
}

const dateTime = (iso: string, locale: AppLocale) =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(new Date(iso));

async function ContributionCard({
  item,
  tab,
  locale,
}: {
  item: StoredContribution;
  tab: ContributionStatus;
  locale: AppLocale;
}) {
  const t = await getTranslations();
  const c = item.contribution;
  const rows: [string, React.ReactNode][] = [];

  if (c.kind === "confirmation") {
    const def = religiousHolidays.find((h) => h.id === c.holidayId);
    const estimate = def && fromHijri({ year: c.hijriYear, month: def.month, day: def.day });
    rows.push(
      [t("contribute.fields.holiday"), `${def?.labels[locale] ?? c.holidayId} ${c.hijriYear}`],
      [
        t("contribute.fields.date"),
        <>
          <strong>{formatDate(c.date, locale)}</strong>
          {estimate ? (
            <span className="ms-2 text-muted">
              ({t("admin.estimate", { date: formatDate(estimate, locale) })})
            </span>
          ) : null}
        </>,
      ],
      [t("contribute.fields.announcedAt"), item.confirmation?.announcedAt ?? c.announcedAt],
    );
  } else if (c.kind === "correction") {
    rows.push([t("contribute.fields.subject"), c.subject]);
    if (c.proposedDate)
      rows.push([t("contribute.fields.proposedDate"), formatDate(c.proposedDate, locale)]);
  } else {
    rows.push([t("contribute.fields.schoolYear"), c.schoolYear]);
  }
  if (c.contact) rows.push([t("contribute.fields.contact"), c.contact]);

  const live = Boolean(item.confirmation);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">{t(`contribute.kinds.${c.kind}.title`)}</h2>
        <span className="text-sm text-muted">
          {t("admin.submitted", { date: dateTime(item.createdAt, locale) })}
        </span>
        <span className="ms-auto font-mono text-xs text-muted">#{item.id}</span>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
        <dt className="text-muted">{t("admin.officialSource")}</dt>
        <dd>
          <a
            href={c.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="inline-flex items-center gap-1.5 break-all text-brand underline underline-offset-4"
          >
            {c.sourceUrl}
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          </a>
        </dd>
      </dl>

      {c.details ? (
        <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-wrap">{c.details}</p>
      ) : null}

      {item.decidedAt && item.decidedBy ? (
        <p className="mt-4 text-sm text-muted">
          {t("admin.decided", {
            status: item.status,
            login: item.decidedBy,
            date: dateTime(item.decidedAt, locale),
          })}
          {item.note ? ` — ${item.note}` : ""}
        </p>
      ) : null}

      {item.status === "pending" ? (
        <form action={decideContribution} className="mt-5 border-t border-line pt-5">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="tab" value={tab} />
          <p className="mb-3 text-sm text-muted">
            {live ? t("admin.appliesLive") : t("admin.recordOnly")}
          </p>
          <label htmlFor={`note-${item.id}`} className="mb-1.5 block text-sm font-medium">
            {t("admin.note")}
          </label>
          <input
            id={`note-${item.id}`}
            name="note"
            maxLength={500}
            className="block h-11 w-full rounded-lg border border-line bg-surface px-3 text-base"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" name="decision" value="accepted" className={buttonVariants()}>
              <Check aria-hidden="true" />
              {t("admin.accept")}
            </button>
            <button
              type="submit"
              name="decision"
              value="rejected"
              className={buttonVariants({ variant: "outline" })}
            >
              <X aria-hidden="true" />
              {t("admin.reject")}
            </button>
          </div>
        </form>
      ) : item.status === "accepted" && live ? (
        <form action={decideContribution} className="mt-5 border-t border-line pt-5">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="tab" value={tab} />
          <button
            type="submit"
            name="decision"
            value="revert"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Undo2 aria-hidden="true" />
            {t("admin.revert")}
          </button>
        </form>
      ) : null}
    </Card>
  );
}
