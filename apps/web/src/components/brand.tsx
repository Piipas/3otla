import { cn } from "@/lib/utils";

/** Eight-point star (khatam), the site mark. */
export function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect x="6" y="6" width="20" height="20" rx="2" fill="currentColor" />
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="2"
        fill="currentColor"
        transform="rotate(45 16 16)"
      />
      <circle cx="16" cy="16" r="4.2" fill="var(--bg)" />
    </svg>
  );
}
