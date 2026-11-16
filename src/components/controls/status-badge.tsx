import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeTone = "green" | "orange" | "blue" | "red" | "gray";

// Kolory (tło / ramka / tekst) wg plakietek statusu z Projects.dc.html
const TONY: Record<BadgeTone, string> = {
  green: "bg-[#f0faf4] border-[#bbe5cc] text-[#15803d]",
  orange: "bg-[#fff4ed] border-[#fed7aa] text-[#c2410c]",
  blue: "bg-[#eef5ff] border-[#cfe2ff] text-[#0070f3]",
  red: "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]",
  gray: "bg-[#f5f5f5] border-[#e0e0e0] text-[#666666]",
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
