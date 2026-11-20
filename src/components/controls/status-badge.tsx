import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeTone = "green" | "orange" | "blue" | "red" | "gray";

// Kolory (tło / ramka / tekst) wg plakietek statusu z Projects.dc.html
const TONY: Record<BadgeTone, string> = {
  green: "bg-success-soft border-success-border text-success",
  orange: "bg-warning-soft border-warning-border text-warning-foreground",
  blue: "bg-info-soft border-info-border text-info-foreground",
  red: "bg-destructive-soft border-destructive-border text-destructive-foreground",
  gray: "bg-muted border-input text-muted-foreground",
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-[4px] border px-[7px] py-0.5 font-mono text-[11px] leading-normal whitespace-nowrap",
        TONY[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
