"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ActionPopover } from "./action-popover";
import { buildMonthGrid, formatDatePl, monthTitlePl, todayIso, type IsoDate } from "./calendar-math";

const DNI_PN = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];
const DNI_ND = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];

// Wybór daty wg dp() z Books.dc.html: dymek 244 px, nagłówek z miesiącem, siatka 7 × 6,
// stopka „Dziś” / „Wyczyść”. Wybór dnia zamyka dymek.
export function DatePicker({
  value,
  onChange,
  weekStart = "mon",
  today,
  ariaLabel,
  placeholder = "Wybierz datę",
}: {
  value: IsoDate | null;
  onChange: (v: IsoDate | null) => void;
  weekStart?: "mon" | "sun";
  today?: IsoDate;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // Wyświetlany miesiąc; ustawiany przy otwarciu na miesiąc wartości albo dzisiejszy
  const [widok, setWidok] = React.useState({ rok: 0, miesiac: 0 });

  // Bieżącą datę liczymy dopiero po otwarciu (po stronie klienta) — `new Date()` w renderze
  // zamkniętej kontrolki psuje prerender w Next 16
  const dzis = today ?? (open ? todayIso() : "");

  function zmienOtwarcie(nowe: boolean) {
    if (nowe) {
      const [r, m] = (value ?? today ?? todayIso()).split("-").map(Number);
      setWidok({ rok: r, miesiac: m - 1 });
    }
    setOpen(nowe);
  }

  function przesun(o: number) {
    setWidok((w) => {
      const n = w.miesiac + o;
      return { rok: w.rok + Math.floor(n / 12), miesiac: ((n % 12) + 12) % 12 };
    });
  }

  function wybierz(d: IsoDate | null) {
    onChange(d);
    setOpen(false);
  }

  const siatka = open ? buildMonthGrid(widok.rok, widok.miesiac, weekStart) : [];

  return (
    <ActionPopover
      open={open}
      onOpenChange={zmienOtwarcie}
      width={244}
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e0e0] bg-white px-2.5 text-[13px] text-[#171717] outline-none hover:border-[#cfcfcf]",
            open && "border-[#171717] hover:border-[#171717]",
          )}
        >
          {value ? (
            <span className="font-mono">{formatDatePl(value)}</span>
          ) : (
            <span className="text-[#a3a3a3]">{placeholder}</span>
          )}
          <ChevronDownIcon aria-hidden="true" className="size-3 flex-none text-[#666666]" />
        </button>
      }
    >
      <div className="mb-1.5 flex items-center justify-between">
        <button
          type="button"
          aria-label="Poprzedni miesiąc"
          onClick={() => przesun(-1)}
          className="size-7 cursor-pointer rounded-md border border-[#e0e0e0] bg-white hover:bg-[#f5f5f5]"
        >
          ‹
        </button>
        <span className="text-[13px] font-semibold">{monthTitlePl(widok.rok, widok.miesiac)}</span>
        <button
          type="button"
          aria-label="Następny miesiąc"
          onClick={() => przesun(1)}
          className="size-7 cursor-pointer rounded-md border border-[#e0e0e0] bg-white hover:bg-[#f5f5f5]"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 pb-1 text-center font-mono text-[10px] text-[#6b6b6b]">
        {(weekStart === "mon" ? DNI_PN : DNI_ND).map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {siatka.map((c) => (
          <button
            key={c.date}
            type="button"
            aria-pressed={c.date === value}
            onClick={() => wybierz(c.date)}
            className={cn(
              "h-[30px] cursor-pointer rounded-md border border-transparent bg-transparent p-0 font-mono text-xs text-[#171717] hover:bg-[#f5f5f5]",
              !c.inMonth && "text-[#b5b5b5]",
              c.date === dzis && "border-[#d4d4d4]",
              c.date === value && "bg-[#171717] text-white hover:bg-[#171717]",
            )}
          >
            {Number(c.date.slice(8))}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between border-t border-[#f0f0f0] pt-1.5">
        <button
          type="button"
          onClick={() => wybierz(today ?? todayIso())}
          className="cursor-pointer rounded-md px-2 py-1 text-xs text-[#404040] hover:bg-[#f5f5f5]"
        >
          Dziś
        </button>
        <button
          type="button"
          onClick={() => wybierz(null)}
          className="cursor-pointer rounded-md px-2 py-1 text-xs text-[#404040] hover:bg-[#f5f5f5]"
        >
          Wyczyść
        </button>
      </div>
    </ActionPopover>
  );
}
