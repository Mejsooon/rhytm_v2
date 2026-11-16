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
        "font-mono text-[11px] tracking-[0.06em] text-[#6b6b6b] uppercase",
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
  id,
  className,
  ...props
}: {
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const opisId = error || hint ? `${inputId}-opis` : undefined;
  return (
    <div className="flex flex-col gap-1.5 text-[13px] font-medium max-[799px]:text-[13px]">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={opisId}
        className={cn(
          "w-full rounded-md border border-[#e0e0e0] bg-white px-[11px] py-[9px] text-sm font-normal text-[#171717] outline-none placeholder:text-[#a3a3a3] focus:border-[#171717] max-[799px]:h-12 max-[799px]:rounded-[10px] max-[799px]:px-3.5 max-[799px]:py-0 max-[799px]:text-[15px]",
          error && "border-[#b91c1c]",
          className,
        )}
        {...props}
      />
      {(error || hint) && (
        <p
          id={opisId}
          className={cn(
            "text-xs font-normal",
            error ? "text-[#b91c1c]" : "text-[#666666]",
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
