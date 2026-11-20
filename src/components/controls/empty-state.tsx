import * as React from "react";

import { cn } from "@/lib/utils";

// .empty + .empty-ic z coss.css
export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-6 py-8 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="grid size-10 place-items-center rounded-md border border-border bg-white text-muted-foreground shadow-xs">
          {icon}
        </div>
      ) : null}
      <p className="m-0 text-base font-semibold leading-[1.3] text-foreground">{title}</p>
      {description ? (
        <p className="m-0 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
