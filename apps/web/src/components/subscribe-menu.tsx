"use client";

import { CalendarPlus, Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";

export interface FeedLinks {
  google: string;
  webcal: string;
  ics: string;
}

export function SubscribeMenu({
  feed,
  calendarLabel,
  variant = "primary",
  className,
}: {
  feed: FeedLinks;
  calendarLabel: string;
  variant?: "primary" | "outline" | "onBrand";
  className?: string;
}) {
  const t = useTranslations("subscribe");
  const [copied, setCopied] = useState(false);

  return (
    <DropdownMenu onOpenChange={(open) => open || setCopied(false)}>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant }), className)}>
        <CalendarPlus />
        {t("button")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>
          {t("title")} · {calendarLabel}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={feed.google} target="_blank" rel="noopener">
            <GoogleIcon />
            {t("google")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={feed.webcal}>
            <AppleIcon />
            {t("apple")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            navigator.clipboard?.writeText(feed.ics).then(() => setCopied(true));
          }}
        >
          {copied ? <Check className="text-confirmed!" /> : <Copy />}
          <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-3 pb-2 text-xs leading-relaxed text-muted">{t("hint")}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#4285F4" />
      <path d="M7 9h10v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" fill="#fff" />
      <path d="M7 6h10v3H7z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#fff" stroke="currentColor" />
      <path d="M3 8a4 4 0 0 1 4-5h10a4 4 0 0 1 4 5z" fill="#FF3B30" />
      <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="700" fill="#111">
        31
      </text>
    </svg>
  );
}
