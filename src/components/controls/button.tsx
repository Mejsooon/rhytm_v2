import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md";

// Warianty wg makiet: Login (przycisk główny), Settings (.btn, .btnp, „Usuń konto”)
const WARIANTY: Record<Variant, string> = {
  // hover zachowuje biały tekst, także gdy przycisk jest linkiem <a>
  primary:
    "bg-primary text-white border border-primary hover:bg-primary-hover hover:text-white",
  secondary:
    "bg-white text-foreground border border-input hover:bg-panel hover:text-foreground",
  destructive:
    "bg-destructive text-white border border-destructive hover:bg-destructive-hover hover:text-white",
  ghost:
    "bg-transparent text-foreground border border-transparent hover:bg-muted hover:text-foreground",
};

// Na telefonie (<800 px) wysokość 48 px i promień 10 px z MLogin.dc.html
const ROZMIARY: Record<Size, string> = {
  sm: "px-3 py-1.5 max-[799px]:h-10 max-[799px]:rounded-md max-[799px]:py-0",
  md: "px-3 py-2.5 max-[799px]:h-12 max-[799px]:rounded-md max-[799px]:py-0",
};

export function Button({
  variant = "secondary",
  size = "md",
  asChild = false,
  className,
  type,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      // Dla <button> domyślnie type="button" (bez przypadkowego submitu)
      {...(asChild ? {} : { type: type ?? "button" })}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium no-underline transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50",
        WARIANTY[variant],
        ROZMIARY[size],
        className,
      )}
      {...props}
    />
  );
}
