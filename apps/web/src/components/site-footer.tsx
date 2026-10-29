import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { REPO_URL } from "@/lib/site";
import { StarMark } from "./brand";

export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-2.5 sm:me-auto">
          <StarMark className="size-5 text-accent" />
          <span>{t("footer.tagline")}</span>
        </div>
        <nav aria-label="Footer" className="-mx-2 flex flex-wrap items-center gap-x-1 gap-y-1">
          <Link
            href="/sources"
            className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-ink"
          >
            {t("nav.sources")}
          </Link>
          <Link
            href="/contribute"
            className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-ink"
          >
            {t("nav.contribute")}
          </Link>
          <a
            href="/docs"
            className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-ink"
          >
            {t("footer.api")}
          </a>
          {REPO_URL ? (
            <a
              href={REPO_URL}
              className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-ink"
            >
              GitHub
            </a>
          ) : null}
          <span className="px-2">{t("footer.data")}</span>
        </nav>
      </div>
    </footer>
  );
}
