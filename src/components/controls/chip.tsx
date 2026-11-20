import * as React from "react";

import { cn } from "@/lib/utils";

// Chip wg BlockDialog.dc.html (web: 12 px, 4×10) i MBlockSheet.dc.html (telefon: 36 px, 14 px).
// variant="solid": zaznaczony chip wypełniony na czarno z białym tekstem (dni w WorkoutTemplates.dc.html)
export function Chip({
  selected = false,
  variant = "outline",
  dashed = false,
  dotColor,
  onClick,
  disabled = false,
  children,
}: {
  selected?: boolean;
  variant?: "outline" | "solid";
  dashed?: boolean;
  dotColor?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs text-soft-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/20 max-[799px]:h-9 max-[799px]:px-3.5 max-[799px]:py-0 max-[799px]:text-sm max-[799px]:text-foreground max-[799px]:after:absolute max-[799px]:after:-inset-y-[5px] max-[799px]:after:inset-x-0 max-[799px]:after:content-[''] disabled:cursor-default disabled:opacity-50",
        dashed ? "border-dashed border-input" : "border-input",
        selected &&
          variant === "outline" &&
          "border-primary font-medium text-foreground",
        selected &&
          variant === "solid" &&
          "border-primary bg-primary text-white max-[799px]:text-white",
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
