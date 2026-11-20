import * as React from "react";

import { cn } from "@/lib/utils";

// Chip wg .chip z coss.css (28 px, na telefonie 36 px); zaznaczony = szare tło.
// variant="solid": zaznaczony chip wypełniony ciemnym kolorem (jak .bdg), np. dni w szablonach treningów
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
        "relative inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[8px] border bg-white px-[9px] text-sm font-medium whitespace-nowrap text-foreground shadow-xs transition-[box-shadow,background-color] duration-150 outline-none hover:bg-panel focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-[.64] max-[799px]:h-9 max-[799px]:px-3.5 max-[799px]:after:absolute max-[799px]:after:-inset-y-[5px] max-[799px]:after:inset-x-0 max-[799px]:after:content-['']",
        dashed ? "border-dashed border-input" : "border-input",
        selected &&
          variant === "outline" &&
          "border-black/[.18] bg-muted shadow-none hover:bg-muted",
        selected &&
          variant === "solid" &&
          "border-primary bg-primary text-primary-foreground shadow-none hover:bg-primary-hover",
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
