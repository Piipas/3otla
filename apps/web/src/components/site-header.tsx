import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { currentYear } from "@/lib/site";
import { StarMark } from "./brand";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme";

export function SiteHeader() {
  const t = useTranslations();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t("nav.skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="me-auto flex items-center gap-2.5 font-semibold">
          <StarMark className="text-brand" />
          <span className="text-lg tracking-tight">
            3otla <span className="text-muted">·</span> <span lang="ar">عطلة</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm sm:flex">
          <Link
            href={`/${currentYear()}`}
            className="rounded-full px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink"
          >
            {t("nav.calendar")}
          </Link>
          <Link
            href="/sources"
            className="rounded-full px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink"
          >
            {t("nav.sources")}
          </Link>
          <a
            href="/docs"
            className="rounded-full px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink"
          >
            {t("nav.api")}
          </a>
        </nav>
        <LocaleSwitcher label={t("ui.language")} />
        <ThemeToggle label={t("ui.theme")} />
      </div>
      <nav
        aria-label="Main"
        className="flex items-center gap-1 overflow-x-auto px-3 pb-2 text-sm sm:hidden"
      >
        <Link href={`/${currentYear()}`} className="rounded-full px-3 py-1.5 text-muted">
          {t("nav.calendar")}
        </Link>
        <Link href="/sources" className="rounded-full px-3 py-1.5 text-muted">
          {t("nav.sources")}
        </Link>
        <a href="/docs" className="rounded-full px-3 py-1.5 text-muted">
          {t("nav.api")}
        </a>
      </nav>
    </header>
  );
}
