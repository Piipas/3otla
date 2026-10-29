"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Unit = "days" | "hours" | "minutes" | "seconds";

function split(ms: number): Record<Unit, number> {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/**
 * Live countdown to `start` (00:00 in Morocco on the holiday's first day).
 * Renders placeholders on the server, then ticks on the client, so markup never mismatches.
 */
export function Countdown({
  start,
  end,
  ongoingLabel,
  passedLabel,
  tone = "brand",
}: {
  /** ISO instant of the first day's start. */
  start: string;
  /** ISO instant right after the last day. */
  end: string;
  ongoingLabel: string;
  passedLabel?: string;
  tone?: "brand" | "surface";
}) {
  const t = useTranslations("countdown");
  const reduce = useReducedMotion();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  if (now !== null && now >= startMs) {
    const label = now < endMs ? ongoingLabel : passedLabel;
    if (label) {
      return (
        <p
          className={cn("text-lg font-medium", tone === "brand" ? "text-white" : "text-confirmed")}
        >
          {label}
        </p>
      );
    }
  }

  const parts = now === null ? null : split(startMs - now);
  const units: Unit[] = ["days", "hours", "minutes", "seconds"];

  return (
    <div role="timer" aria-label={t("label")} className="flex gap-2 sm:gap-3">
      {units.map((unit) => {
        const value = parts?.[unit];
        const text = value === undefined ? "––" : String(value).padStart(2, "0");
        return (
          <div
            key={unit}
            className={cn(
              "flex w-[4.5rem] flex-col items-center rounded-arch px-2 pt-5 pb-3 sm:w-24 sm:pt-7",
              tone === "brand"
                ? "bg-white/10 text-white ring-1 ring-white/20"
                : "bg-surface-2 text-ink ring-1 ring-line",
            )}
          >
            <span className="relative h-9 overflow-hidden text-3xl leading-9 font-semibold tabular-nums sm:h-12 sm:text-5xl sm:leading-[3rem]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={text}
                  className="block"
                  initial={reduce ? false : { y: "-100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                >
                  {text}
                </motion.span>
              </AnimatePresence>
            </span>
            <span
              className={cn(
                "mt-1 text-[0.7rem] sm:text-xs",
                tone === "brand" ? "text-white/70" : "text-muted",
              )}
            >
              {t(unit, { count: value ?? 0 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
