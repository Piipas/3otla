import { dataset } from "@3otla/data";
import {
  BadgeCheck,
  CalendarCheck,
  ExternalLink,
  MessageSquareWarning,
  MoonStar,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FadeIn } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { alternates, REPO_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

type Params = Promise<{ locale: AppLocale }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("sourcesTitle"), alternates: alternates(locale, "/sources") };
}

export default async function SourcesPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const urls = [
    ...new Set([
      ...dataset.holidays.map((h) => h.sourceUrl),
      ...dataset.holidays.flatMap((h) =>
        (h.decisionRefs ?? []).flatMap((d) => (d.url ? [d.url] : [])),
      ),
      ...dataset.confirmations.map((c) => c.sourceUrl),
    ]),
  ];

  const statuses = [
    { key: "fixed", Icon: CalendarCheck, tone: "bg-fixed-soft text-fixed" },
    { key: "estimated", Icon: MoonStar, tone: "bg-estimated-soft text-estimated" },
    { key: "confirmed", Icon: BadgeCheck, tone: "bg-confirmed-soft text-confirmed" },
  ] as const;

  return (
    <FadeIn className="max-w-3xl pt-10 sm:pt-14">
      <h1 className="text-4xl font-semibold sm:text-5xl">{t("sources.title")}</h1>
      <p className="mt-4 text-lg text-muted">{t("sources.intro")}</p>

      <section aria-labelledby="statuses" className="mt-12">
        <h2 id="statuses" className="mb-4 text-2xl font-semibold">
          {t("sources.statusTitle")}
        </h2>
        <div className="grid gap-3">
          {statuses.map(({ key, Icon, tone }) => (
            <Card key={key} id={key} className="flex gap-4 p-5">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold">{t(`status.${key}`)}</h3>
                <p className="mt-1 text-muted">{t(`status.${key}Help`)}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="national" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-semibold">{t("sources.nationalTitle")}</h2>
        <p className="mt-3 leading-relaxed text-muted">{t("sources.nationalBody")}</p>
      </section>

      <section id="religious" className="mt-10 scroll-mt-24">
        <h2 className="text-2xl font-semibold">{t("sources.religiousTitle")}</h2>
        <p className="mt-3 leading-relaxed text-muted">{t("sources.religiousBody")}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">{t("sources.list")}</h2>
        <ul className="mt-4 space-y-2">
          {urls.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener"
                dir="ltr"
                className="inline-flex items-center gap-1.5 break-all text-brand underline decoration-brand/30 underline-offset-4"
              >
                {url}
                <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">{t("sources.correctionsTitle")}</h2>
        <p className="mt-3 leading-relaxed text-muted">
          {t("sources.correctionsBody")}{" "}
          {REPO_URL ? (
            <a href={REPO_URL} className="text-brand underline">
              GitHub
            </a>
          ) : null}
        </p>
        <Link href="/contribute" className={cn(buttonVariants(), "mt-4")}>
          <MessageSquareWarning aria-hidden="true" />
          {t("contribute.cta")}
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">{t("sources.licenseTitle")}</h2>
        <p className="mt-3 text-muted">{t("sources.licenseBody")}</p>
      </section>
    </FadeIn>
  );
}
