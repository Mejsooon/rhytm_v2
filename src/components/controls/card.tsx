import * as React from "react";

import { cn } from "@/lib/utils";

// .card z coss.css: ramka, promień 16 px, cień xs
export function Card({ className, children, ...div }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-xs",
        className,
      )}
      {...div}
    >
      {children}
    </div>
  );
}

// .card-h
export function CardHeader({ className, children, ...div }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-start justify-between gap-3 px-6 pt-5", className)}
      {...div}
    >
      {children}
    </div>
  );
}

// .card-t — poziom nagłówka wybierany propem `as`
export function CardTitle({
  as: Tag = "h3",
  className,
  children,
  ...heading
}: React.ComponentProps<"h3"> & { as?: "h2" | "h3" }) {
  return (
    <Tag
      className={cn("m-0 text-base font-semibold leading-[1.3]", className)}
      {...heading}
    >
      {children}
    </Tag>
  );
}

// .card-d
export function CardDescription({ className, children, ...p }: React.ComponentProps<"p">) {
  return (
    <p className={cn("mt-1 mb-0 text-sm text-muted-foreground", className)} {...p}>
      {children}
    </p>
  );
}

// .card-p
export function CardContent({ className, children, ...div }: React.ComponentProps<"div">) {
  return (
    <div className={cn("px-6 py-5", className)} {...div}>
      {children}
    </div>
  );
}

// .foot — ta sama konwencja co stopka FormDialog
export function CardFooter({ className, children, ...div }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-black/[.025] px-6 py-3.5 rounded-b-[15px]",
        className,
      )}
      {...div}
    >
      {children}
    </div>
  );
}
