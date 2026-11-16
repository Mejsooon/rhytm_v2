import * as React from "react";

import { cn } from "@/lib/utils";

// Chip wg BlockDialog.dc.html (web: 12 px, 4×10) i MBlockSheet.dc.html (telefon: 36 px, 14 px)
export function Chip({
  selected = false,
  dashed = false,
  dotColor,
  onClick,
  children,
}: {
  selected?: boolean;
  dashed?: boolean;
  dotColor?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs text-[#404040] outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20 max-[799px]:h-9 max-[799px]:px-3.5 max-[799px]:py-0 max-[799px]:text-sm max-[799px]:text-[#171717]",
        dashed ? "border-dashed border-[#e0e0e0]" : "border-[#e0e0e0]",
        selected && "border-[#171717] font-medium text-[#171717]",
      )}
    >
      {dotColor && (
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ background: dotColor }}
        />
      )}
      {children}
    </button>
  );
}
