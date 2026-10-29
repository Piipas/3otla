import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export const isRtl = (locale: string) => locale === "ar";

/** Intl locale per site locale: Moroccan Arabic month names (ماي, يوليوز) with Latin digits. */
export const INTL_LOCALE: Record<AppLocale, string> = { ar: "ar-MA", fr: "fr-MA", en: "en-GB" };
