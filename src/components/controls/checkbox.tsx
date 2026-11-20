"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Checkbox wg .cbx z coss.css (16 px); na telefonie obszar dotyku ≥ 44 px przez pseudoelement.
// Etykieta jest osobnym elementem (może zawierać linki), a kwadrat dostaje nazwę przez aria-labelledby.
export function Checkbox({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const labelId = React.useId();
  return (
    <div className="inline-flex items-center gap-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex size-4 flex-none cursor-pointer items-center justify-center rounded-[4px] border p-0 shadow-xs transition-[box-shadow,background-color] duration-150 outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-[.64] disabled:shadow-none max-[799px]:before:absolute max-[799px]:before:-inset-3.5 max-[799px]:before:content-['']",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-white text-transparent",
        )}
      >
        {checked && (
          <CheckIcon aria-hidden="true" strokeWidth={3} className="size-3" />
        )}
      </button>
      {label && (
        <span
          id={labelId}
          className="text-sm text-foreground"
          onClick={(e) => {
            // Klik w link w etykiecie (np. regulamin) nie przełącza pola
            if ((e.target as HTMLElement).closest("a")) return;
            if (disabled) return;
            onChange(!checked);
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
