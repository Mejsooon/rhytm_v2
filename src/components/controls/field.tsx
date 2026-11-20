import * as React from "react";

import { cn } from "@/lib/utils";

// Etykieta mono: Geist Mono 11 px, wersaliki, letter-spacing .06em, #6b6b6b
export function MonoLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Pole tekstowe z etykietą wg Login/Settings (ramka #e0e0e0, 6 px, fokus #171717);
// na telefonie 48 px wysokości i promień 10 px z MLogin.dc.html
export function TextField({
  label,
  error,
  hint,
  webPlaceholder,
  id,
  className,
  ...props
}: {
  label: React.ReactNode;
  error?: string;
  hint?: string;
  // Inny tekst podpowiedzi na webie (≥800 px) — nakładka widoczna tylko przy pustym polu
  webPlaceholder?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const opisId = error || hint ? `${inputId}-opis` : undefined;
  return (
    <div className="flex flex-col gap-1.5 text-[13px] font-medium max-[799px]:text-[13px]">
      <label htmlFor={inputId}>{label}</label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={opisId}
          className={cn(
            "peer w-full rounded-md border border-input bg-white px-[11px] py-[9px] text-sm font-normal text-foreground outline-none placeholder:text-faint-foreground focus:border-primary max-[799px]:h-12 max-[799px]:rounded-md max-[799px]:px-3.5 max-[799px]:py-0 max-[799px]:text-[15px]",
            webPlaceholder && "min-[800px]:placeholder:text-transparent",
            error && "border-destructive",
            className,
          )}
          {...props}
        />
        {webPlaceholder && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2 text-sm leading-[1.21] text-faint-foreground opacity-0 peer-placeholder-shown:opacity-100 max-[799px]:hidden"
          >
            {webPlaceholder}
          </span>
        )}
      </div>
      {(error || hint) && (
        <p
          id={opisId}
          className={cn(
            "text-xs font-normal",
            error ? "text-destructive-foreground" : "text-muted-foreground",
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
