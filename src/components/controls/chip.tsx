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
  ariaLabel,
  className,
  style,
  children,
}: {
  selected?: boolean;
  variant?: "outline" | "solid";
  dashed?: boolean;
  dotColor?: string;
  onClick?: () => void;
  disabled?: boolean;
  // Dostępna nazwa, gdy napis na chipie jest skrótem (np. „Pn” → „poniedziałek”)
  ariaLabel?: string;
  // Dodatkowe klasy i styl (np. kolor kategorii z danych)
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={cn(
        // Tło po najechaniu tylko dla włączonego chipa (enabled:hover:…), więc wyłączony nie mruga
        "relative inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[8px] border bg-white px-[9px] text-sm font-medium whitespace-nowrap text-foreground shadow-xs transition-[box-shadow,background-color] duration-150 outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-[.64] max-[799px]:h-9 max-[799px]:px-3.5 max-[799px]:after:absolute max-[799px]:after:-inset-y-[5px] max-[799px]:after:inset-x-0 max-[799px]:after:content-['']",
        !selected && "enabled:hover:bg-panel",
        // Przerywany („+ Nowa” z CBlockDialog): szary tekst, bez cienia
        dashed
          ? "border-dashed border-input text-muted-foreground shadow-none"
          : "border-input",
        selected &&
          variant === "outline" &&
          "border-black/[.18] bg-muted shadow-none enabled:hover:bg-muted",
        selected &&
          variant === "solid" &&
          "border-primary bg-primary text-primary-foreground shadow-none enabled:hover:bg-primary-hover",
        className,
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
