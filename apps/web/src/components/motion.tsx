"use client";

import { todayInCasablanca } from "@3otla/core";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect } from "react";

/** Fades and lifts content in on mount (calendar year changes, page sections). */
export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Marks today's cell in a statically rendered calendar (the build date would be stale). */
export function TodayMarker() {
  useEffect(() => {
    const cell = document.querySelector(`[data-date="${todayInCasablanca()}"]`);
    cell?.setAttribute("data-today", "true");
    return () => cell?.removeAttribute("data-today");
  }, []);
  return null;
}
