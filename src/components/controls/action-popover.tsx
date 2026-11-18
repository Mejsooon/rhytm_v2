"use client";

import * as React from "react";
import { Popover } from "radix-ui";

// Dymek wg .ddpop z Settings.dc.html: promień 10 px, cień, ramka #eaeaea.
// `trigger` musi być pojedynczym elementem (np. <Button>) — Radix przejmuje jego klik.
export function ActionPopover({
  trigger,
  open,
  onOpenChange,
  width,
  align = "start",
  side = "bottom",
  ariaLabel,
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
          sideOffset={6}
          avoidCollisions
          collisionPadding={8}
          style={width ? { width } : undefined}
          className="z-[70] rounded-[10px] border border-[#eaeaea] bg-white p-2.5 text-sm text-[#171717] shadow-[0_12px_32px_rgba(0,0,0,.12)] outline-none"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
