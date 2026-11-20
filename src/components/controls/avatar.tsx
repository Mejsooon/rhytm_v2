import * as React from "react";

import { cn } from "@/lib/utils";

// .avatar z coss.css: 32 px, okrągły, inicjały
export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 flex-none items-center justify-center rounded-full bg-muted text-[13px] font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border)]",
        className,
      )}
    >
      {initials}
    </span>
  );
}
