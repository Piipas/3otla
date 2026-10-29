import { SUPPORTED_YEARS } from "@3otla/core";
import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { HOLIDAY_IDS, occurrencesStartingIn } from "@/lib/holidays";
import { currentYear, SITE_URL } from "@/lib/site";

function entry(
  path: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`]));
  return routing.locales.map((locale) => ({
    url: `${SITE_URL}/${locale}${path}`,
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = currentYear();
  const entries: MetadataRoute.Sitemap = [
    ...entry("", 1, "daily"),
    ...entry("/sources", 0.3, "monthly"),
  ];
  for (let year = SUPPORTED_YEARS.min; year <= SUPPORTED_YEARS.max; year++) {
    const near = Math.abs(year - now) <= 1;
    entries.push(...entry(`/${year}`, near ? 0.9 : 0.5, near ? "weekly" : "monthly"));
    for (const id of HOLIDAY_IDS) {
      if (occurrencesStartingIn(year, id).length > 0) {
        entries.push(...entry(`/${year}/${id}`, near ? 0.8 : 0.4, near ? "weekly" : "monthly"));
      }
    }
  }
  return entries;
}
