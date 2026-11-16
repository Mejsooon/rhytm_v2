"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Checkbox wg MRegister.dc.html (.cb, 24 px, promień 7) — na webie 18 px.
// Etykieta jest osobnym elementem (może zawierać linki), a kwadrat dostaje nazwę przez aria-labelledby.
export function Checkbox({
  checked,
  onChange,
  label,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  ariaLabel?: string;
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
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex size-[18px] flex-none cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] p-0 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20 max-[799px]:size-6 max-[799px]:rounded-[7px]",
          checked
            ? "border-[#15803d] bg-[#15803d]"
            : "border-[#cfcfcf] bg-white",
        )}
      >
        {checked && (
          <CheckIcon
            aria-hidden="true"
            strokeWidth={3}
            className="size-3 max-[799px]:size-4"
          />
        )}
      </button>
      {label && (
        <span
          id={labelId}
          className="text-[13px] text-[#171717] max-[799px]:text-sm"
          onClick={(e) => {
            // Klik w link w etykiecie (np. regulamin) nie przełącza pola
            if ((e.target as HTMLElement).closest("a")) return;
            onChange(!checked);
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
