"use client";

import { cn } from "@/lib/utils";

// Przełącznik wg .sw z coss.css (36×20); na telefonie obszar dotyku ≥ 44 px przez pseudoelement
export function Switch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        "relative h-5 w-9 flex-none cursor-pointer rounded-full border-2 border-transparent bg-black/12 p-0 shadow-[inset_0_1px_1px_rgba(0,0,0,.04)] transition-colors duration-150 outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--ring)] max-[799px]:before:absolute max-[799px]:before:-inset-3 max-[799px]:before:content-['']",
        checked && "bg-primary",
        disabled && "cursor-not-allowed opacity-[.64]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 left-0 size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.16)] transition-transform duration-150",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}
