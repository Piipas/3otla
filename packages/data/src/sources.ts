/**
 * Source policy: every sourceUrl must point to an official Moroccan source.
 * Aggregators, news and job sites are never acceptable, even when they are correct.
 */

/** Hosts (and their subdomains) accepted as official sources. */
export const OFFICIAL_HOSTS = [
  "maroc.ma", // Portail national du Maroc
  "gov.ma", // Ministries: habous.gov.ma, men.gov.ma, sgg.gov.ma, ...
  "mapexpress.ma", // Agence Maghreb Arabe Presse (official announcements)
  "map.ma",
  // Enseignement français au Maroc: official site of the AEFE network in Morocco, which
  // publishes the school calendar signed by the French Embassy's cooperation service.
  "efmaroc.org",
] as const;

/** Known aggregators and secondary sources, listed so a PR adding one fails loudly. */
export const BANNED_HOSTS = [
  "calendarific.com",
  "holidayapi.com",
  "timeanddate.com",
  "officeholidays.com",
  "publicholidays.ma",
  "publicholidays.africa",
  "qppstudio.net",
  "nager.at",
  "wikipedia.org",
  "rekrute.com",
  "emploi.ma",
  "hespress.com",
  "le360.ma",
  "medias24.com",
  "hibapress.com",
  "yabiladi.com",
] as const;

const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export type SourceCheck = { ok: true } | { ok: false; reason: string };

export function checkSourceUrl(raw: string): SourceCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "not a valid URL" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "must use https" };
  const host = url.hostname.toLowerCase();
  if (BANNED_HOSTS.some((d) => matches(host, d))) {
    return { ok: false, reason: `${host} is an aggregator or secondary source` };
  }
  if (!OFFICIAL_HOSTS.some((d) => matches(host, d))) {
    return { ok: false, reason: `${host} is not on the official source allowlist` };
  }
  return { ok: true };
}
