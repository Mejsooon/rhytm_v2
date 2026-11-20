import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeTone =
  "green" | "orange" | "blue" | "red" | "gray" | "outline" | "dark";

// Tony wg .bdg z coss.css: green → .ok, orange → .warn, blue → .info, red → .bad,
// gray → .sec, outline → .out, dark → domyślny ciemny
const TONY: Record<BadgeTone, string> = {
  green: "bg-success-soft text-success",
  orange: "bg-warning-soft text-warning-foreground",
  blue: "bg-info-soft text-info-foreground",
  red: "bg-destructive-soft text-destructive-foreground",
  gray: "bg-muted text-foreground",
  outline: "border-input bg-white text-foreground",
  dark: "bg-primary text-primary-foreground",
};

// Rozmiary: sm 18 px, lg 22 px
const ROZMIARY = {
  sm: "h-[18px] px-[5px] text-xs",
  lg: "h-[22px] px-[7px] text-[13px]",
};

export function StatusBadge({
  tone,
  size = "sm",
  children,
  className,
}: {
  tone: BadgeTone;
  size?: "sm" | "lg";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[18px] items-center justify-center gap-1 rounded-sm border border-transparent leading-none font-medium whitespace-nowrap",
        ROZMIARY[size],
        TONY[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
