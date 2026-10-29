import { todayInCasablanca, toHijri } from "@3otla/core";
import { religiousHolidays } from "@3otla/data";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ContributeForm } from "@/components/contribute-form";
import { FadeIn } from "@/components/motion";
import { Card } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/routing";
import { alternates } from "@/lib/site";

type Params = Promise<{ locale: AppLocale }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contribute" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: alternates(locale, "/contribute"),
  };
}

export default async function ContributePage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contribute");
  const hijriHolidays = religiousHolidays
    .filter((h) => h.type === "hijri")
    .map((h) => ({ id: h.id, label: h.labels[locale] }));

  return (
    <div className="grid gap-10 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        <FadeIn>
          <h1 className="text-4xl font-semibold text-balance sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-pretty text-muted">{t("intro")}</p>
        </FadeIn>
        <FadeIn delay={0.05} className="mt-10">
          <Suspense>
            <ContributeForm
              hijriHolidays={hijriHolidays}
              defaultHijriYear={toHijri(todayInCasablanca()).year}
            />
          </Suspense>
        </FadeIn>
      </div>
      <FadeIn delay={0.1} className="lg:pt-32">
        <Card className="p-6 lg:sticky lg:top-24">
          <h2 className="font-semibold">{t("howTitle")}</h2>
          <ol className="mt-4 space-y-4 text-sm">
            {(["step1", "step2", "step3"] as const).map((step, i) => (
              <li key={step} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="pt-1 text-muted">{t(step)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </FadeIn>
    </div>
  );
}
