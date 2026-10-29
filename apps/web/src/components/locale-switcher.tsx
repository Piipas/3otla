"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { type AppLocale, routing } from "@/i18n/routing";
import { buttonVariants } from "./ui/button";

const NAMES: Record<AppLocale, string> = { ar: "العربية", fr: "Français", en: "English" };

export function LocaleSwitcher({ label }: { label: string }) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        aria-label={label}
      >
        <Languages />
        <span>{NAMES[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {routing.locales.map((l) => (
          <DropdownMenuItem key={l} asChild>
            <Link
              href={pathname}
              locale={l}
              lang={l}
              dir={l === "ar" ? "rtl" : "ltr"}
              aria-current={l === locale ? "true" : undefined}
              className="aria-[current]:font-semibold aria-[current]:text-brand"
            >
              {NAMES[l]}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
