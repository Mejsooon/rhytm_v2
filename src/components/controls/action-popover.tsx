"use client";

import * as React from "react";
import { Popover } from "radix-ui";

// Pozycje menu wg coss.css (.mi, .mi.bad, .mi-sep, .mi-lbl); na telefonie cel dotykowy 44 px.
export const MENU_ITEM =
  "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-sm text-foreground no-underline outline-none hover:bg-accent focus-visible:bg-accent max-[799px]:min-h-11";
export const MENU_ITEM_DANGER =
  "text-destructive-foreground hover:bg-destructive/[.06] focus-visible:bg-destructive/[.06]";
export const MENU_SEPARATOR = "-mx-1 my-1 h-px bg-border";
export const MENU_LABEL =
  "px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground";

// Dymek wg .pop z coss.css: promień 12 px, ramka border, cień shadow-lg, padding 4 px.
// `trigger` musi być pojedynczym elementem (np. <Button>) — Radix przejmuje jego klik.
export function ActionPopover({
  trigger,
  open,
  onOpenChange,
  width,
  align = "start",
  side = "bottom",
  ariaLabel,
  onCloseAutoFocus,
  children,
}: {
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: number;
  align?: "start" | "end";
  side?: "top" | "bottom";
  // Nazwa dymku (role="dialog") dla czytników ekranu, np. „Dodaj ćwiczenie”
  ariaLabel?: string;
  // Zwrot fokusu na wyzwalacz po zamknięciu; preventDefault wyłącza go (np. gdy zaraz otwiera się inny dymek)
  onCloseAutoFocus?: (e: Event) => void;
  children: React.ReactNode;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          side={side}
          aria-label={ariaLabel}
          onCloseAutoFocus={onCloseAutoFocus}
          sideOffset={6}
          avoidCollisions
          collisionPadding={8}
          style={width ? { width } : undefined}
          className="z-[70] rounded-lg border border-border bg-white bg-clip-padding p-1 text-sm text-foreground shadow-lg outline-none"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
