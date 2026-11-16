"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ActionPopover } from "./action-popover";

const GODZINY = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTY = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const KOMORKA =
  "h-[30px] cursor-pointer rounded-md border border-transparent bg-transparent p-0 font-mono text-xs text-[#171717] hover:bg-[#f5f5f5] aria-pressed:bg-[#171717] aria-pressed:text-white";

// Wybór godziny wg .tmb / .tpop / .tgrid / .tcell z SettingsNotifications.dc.html.
// Klik godziny zostawia dymek otwarty, klik minut go zamyka.
export function TimePicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string; // 'HH:MM'
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [godzina, minuta] = value.split(":");

  return (
    <ActionPopover
      open={open}
      onOpenChange={setOpen}
      width={268}
      align="end"
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e0e0] bg-white px-2.5 font-mono text-[13px] text-[#171717] outline-none hover:border-[#cfcfcf]",
            open && "border-[#171717] hover:border-[#171717]",
          )}
        >
          {value}
          <ChevronDownIcon aria-hidden="true" className="size-3 flex-none text-[#666666]" />
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[11px] uppercase tracking-[.06em] text-[#6b6b6b]">
          Godzina
        </div>
        <div className="grid grid-cols-6 gap-[3px]">
          {GODZINY.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={g === godzina}
              onClick={() => onChange(`${g}:${minuta}`)}
              className={KOMORKA}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[.06em] text-[#6b6b6b]">
          Minuty
        </div>
        <div className="grid grid-cols-6 gap-[3px]">
          {MINUTY.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === minuta}
              onClick={() => {
                onChange(`${godzina}:${m}`);
                setOpen(false);
              }}
              className={KOMORKA}
            >
              :{m}
            </button>
          ))}
        </div>
        <div className="flex justify-end border-t border-[#f0f0f0] pt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-md border border-[#e0e0e0] bg-white px-2.5 py-[5px] text-[13px] hover:bg-[#fafafa]"
          >
            Gotowe
          </button>
        </div>
      </div>
    </ActionPopover>
  );
}
