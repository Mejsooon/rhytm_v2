import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "secondary"
  | "soft"
  | "ghost"
  | "destructive"
  | "destructive-outline";
type Size = "xs" | "sm" | "md" | "lg";

// Warianty wg coss.css: .btnp, .btn, .btns, .btng, .btnd, .btndo
const WARIANTY: Record<Variant, string> = {
  // hover zachowuje jasny tekst, także gdy przycisk jest linkiem <a>
  primary:
    "bg-primary text-primary-foreground border-primary shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_1px_2px_rgba(38,38,38,.24)] hover:bg-primary-hover hover:text-primary-foreground",
  secondary:
    "bg-white text-foreground border-input bg-clip-padding shadow-[0_1px_2px_rgba(0,0,0,.05),inset_0_-1px_0_rgba(0,0,0,.04)] hover:bg-panel hover:text-foreground",
  soft: "bg-muted text-foreground border-transparent hover:bg-black/[.07] hover:text-foreground",
  ghost:
    "bg-transparent text-foreground border-transparent hover:bg-accent hover:text-foreground aria-expanded:bg-accent",
  destructive:
    "bg-destructive text-white border-destructive shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_1px_2px_rgba(239,68,68,.24)] hover:bg-destructive-hover hover:text-white",
  "destructive-outline":
    "bg-white text-destructive-foreground border-input shadow-xs hover:border-destructive/[.32] hover:bg-destructive/[.04] hover:text-destructive-foreground",
};

// Wysokości 24/28/32/36 px; na telefonie (<800 px) sm 40 px, md/lg 44 px, xs bez zmian
const ROZMIARY: Record<Size, string> = {
  xs: "h-6 gap-1 rounded-[8px] px-[7px] text-xs",
  sm: "h-7 gap-1.5 px-[9px] max-[799px]:h-10",
  md: "h-8 gap-2 px-[11px] max-[799px]:h-11",
  lg: "h-9 gap-2 px-[13px] max-[799px]:h-11",
};

// Przycisk kwadratowy: szerokość = wysokość (na telefonie też)
const IKONA: Record<Size, string> = {
  xs: "w-6 px-0",
  sm: "w-7 px-0 max-[799px]:w-10",
  md: "w-8 px-0 max-[799px]:w-11",
  lg: "w-9 px-0 max-[799px]:w-11",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon = false,
  asChild = false,
  className,
  type,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  icon?: boolean;
  asChild?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      // Dla <button> domyślnie type="button" (bez przypadkowego submitu)
      {...(asChild ? {} : { type: type ?? "button" })}
      className={cn(
        "relative inline-flex flex-none cursor-pointer items-center justify-center rounded-md border text-sm leading-none font-medium whitespace-nowrap no-underline transition-[box-shadow,background-color,color] duration-150 outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-[.64] disabled:shadow-none aria-disabled:cursor-not-allowed aria-disabled:opacity-[.64] aria-disabled:shadow-none [&_svg]:flex-none [&_svg]:opacity-80",
        WARIANTY[variant],
        ROZMIARY[size],
        icon && IKONA[size],
        className,
      )}
      {...props}
    />
  );
}
