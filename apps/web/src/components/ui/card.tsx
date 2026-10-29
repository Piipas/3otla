import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface shadow-[0_1px_0_0_var(--line),0_18px_40px_-28px_rgb(30_27_22/0.35)]",
        className,
      )}
      {...props}
    />
  );
}
