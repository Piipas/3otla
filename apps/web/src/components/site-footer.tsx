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
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/sources" className="hover:text-ink">
            {t("nav.sources")}
          </Link>
          <a href="/docs" className="hover:text-ink">
            {t("footer.api")}
          </a>
          {REPO_URL ? (
            <a href={REPO_URL} className="hover:text-ink">
              GitHub
            </a>
          ) : null}
          <span>{t("footer.data")}</span>
        </nav>
      </div>
    </footer>
  );
}
