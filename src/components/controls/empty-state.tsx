import * as React from "react";

import { cn } from "@/lib/utils";

// .empty + .empty-ic z coss.css
export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
  iconClassName,
  titleAs: Tytul = "p",
  titleId,
  titleClassName,
  descriptionClassName,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  // Dodatkowe klasy ramki ikony, tytułu i opisu (np. większy pusty stan na ekranie telefonu)
  iconClassName?: string;
  // Element tytułu: domyślnie akapit; na pełnym ekranie nagłówek (h1/h2)
  titleAs?: "p" | "h1" | "h2";
  // Id tytułu (np. aria-labelledby formularza)
  titleId?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-6 py-8 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "grid size-10 place-items-center rounded-md border border-border bg-white text-muted-foreground shadow-xs",
            iconClassName,
          )}
        >
          {icon}
        </div>
      ) : null}
      <Tytul
        id={titleId}
        className={cn(
          "m-0 text-base font-semibold leading-[1.3] text-foreground",
          titleClassName,
        )}
      >
        {title}
      </Tytul>
      {description ? (
        <p className={cn("m-0 text-sm text-muted-foreground", descriptionClassName)}>
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}
