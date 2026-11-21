import * as React from "react";

import { cn } from "@/lib/utils";

// .prog z coss.css: tor 6 px, wypełnienie zielone (success) jak na makietach COSS
export function Progress({
  value,
  max = 100,
  ariaLabel,
  className,
}: {
  value: number;
  max?: number;
  ariaLabel: string;
  className?: string;
}) {
  // max <= 0 daje 0%, żeby nie wyszło NaN
  const procent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full bg-success" style={{ width: `${procent}%` }} />
    </div>
  );
}
