import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <div className="flex flex-col items-start gap-6 py-24">
      <p className="text-7xl font-semibold text-accent">404</p>
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <Button asChild>
        <Link href="/">{t("back")}</Link>
      </Button>
    </div>
  );
}
