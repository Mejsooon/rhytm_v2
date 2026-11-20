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

// Klasy pola wg .inp z coss.css: 32 px (na telefonie 44 px), promień 10 px, cień xs,
// fokus: ramka ring + halo 3 px; błąd: czerwona ramka (aria-invalid)
export const FIELD =
  "block h-8 w-full min-w-0 rounded-md border border-input bg-white bg-clip-padding px-[11px] text-sm font-normal text-foreground shadow-xs outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-faint-foreground focus:border-ring focus:shadow-[0_0_0_3px_rgba(163,163,163,.24)] aria-[invalid=true]:border-destructive/[.36] aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgba(239,68,68,.16)] disabled:cursor-not-allowed disabled:opacity-[.64] max-[799px]:h-11 max-[799px]:text-[15px]";

// Pole tekstowe z etykietą (.inp z coss.css)
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
            "peer",
            FIELD,
            webPlaceholder && "min-[800px]:placeholder:text-transparent",
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
