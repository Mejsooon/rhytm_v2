import * as React from "react";

import { cn } from "@/lib/utils";

// .kbd z coss.css
export function Kbd({ children, className, ...kbd }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] bg-muted px-1 font-sans text-xs font-medium text-muted-foreground",
        className,
      )}
      {...kbd}
    >
      {children}
    </kbd>
  );
}
