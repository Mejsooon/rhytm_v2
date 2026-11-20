"use client";

import { cn } from "@/lib/utils";

// Przełącznik wg SettingsNotifications.dc.html (.sw, 40×22) i MRegister.dc.html (telefon, 50×30)
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
        "relative h-[22px] w-10 flex-none cursor-pointer rounded-full border-0 p-0 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/20 max-[799px]:h-[30px] max-[799px]:w-[50px]",
        checked ? "bg-success" : "bg-border-strong max-[799px]:bg-border-strong",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[3px] left-[3px] size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-transform duration-150 max-[799px]:size-6 max-[799px]:shadow-[0_1px_3px_rgba(0,0,0,.25)]",
          checked && "translate-x-[18px] max-[799px]:translate-x-5",
        )}
      />
    </button>
  );
}
