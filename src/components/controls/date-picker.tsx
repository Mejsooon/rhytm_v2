"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ActionPopover } from "./action-popover";
import {
  buildMonthGrid,
  formatDatePl,
  monthTitlePl,
  todayIso,
  type IsoDate,
} from "./calendar-math";

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
  min,
  max,
  variant = "box",
  size = "md",
}: {
  value: IsoDate | null;
  onChange: (v: IsoDate | null) => void;
  weekStart?: "mon" | "sun";
  today?: IsoDate;
  ariaLabel: string;
  placeholder?: string;
  // Najwcześniejszy dozwolony dzień: wcześniejsze są zablokowane (także „Dziś”, gdy dziś < min)
  min?: IsoDate;
  // Najpóźniejszy dozwolony dzień: późniejsze są zablokowane (także „Dziś”, gdy dziś > max)
  max?: IsoDate;
  // „bare”: goły tekst mono bez ramki i strzałki (komórka tabeli z EmptyPage.dc.html)
  variant?: "box" | "bare";
  // „sm”: przycisk 28 px, tekst 12 px mono (btnBase z Books.dc.html, tryb edycji wiersza)
  size?: "md" | "sm";
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

  const siatka = open
    ? buildMonthGrid(widok.rok, widok.miesiac, weekStart)
    : [];
  // „Dziś” jest blokowane, gdy dzisiejszy dzień leży poza zakresem min–max
  const dzisPozaZakresem =
    (min !== undefined && dzis < min) || (max !== undefined && dzis > max);

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
            variant === "bare"
              ? "inline-flex min-h-5 cursor-pointer items-center rounded-sm border-0 bg-transparent p-0 font-[inherit] text-[13px] text-soft-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/20 max-[799px]:min-h-11"
              : size === "sm"
                ? "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-white px-2 font-mono text-xs whitespace-nowrap text-foreground outline-none hover:border-border-strong"
                : "inline-flex h-[30px] max-[799px]:h-11 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-white px-2.5 text-[13px] text-foreground outline-none hover:border-border-strong",
            variant === "box" && open && "border-primary hover:border-primary",
          )}
        >
          {value ? (
            <span className="font-mono">{formatDatePl(value)}</span>
          ) : (
            <span className={size === "sm" ? "text-muted-foreground" : "text-faint-foreground"}>{placeholder}</span>
          )}
          {variant === "box" && (
            <ChevronDownIcon
              aria-hidden="true"
              className="size-3 flex-none text-muted-foreground"
            />
          )}
        </button>
      }
    >
      <div className="mb-1.5 flex items-center justify-between">
        <button
          type="button"
          aria-label="Poprzedni miesiąc"
          onClick={() => przesun(-1)}
          className="size-7 cursor-pointer rounded-md border border-input bg-white hover:bg-muted"
        >
          ‹
        </button>
        <span className="text-[13px] font-semibold">
          {monthTitlePl(widok.rok, widok.miesiac)}
        </span>
        <button
          type="button"
          aria-label="Następny miesiąc"
          onClick={() => przesun(1)}
          className="size-7 cursor-pointer rounded-md border border-input bg-white hover:bg-muted"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 pb-1 text-center font-mono text-[10px] text-muted-foreground">
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
            disabled={
              (min !== undefined && c.date < min) ||
              (max !== undefined && c.date > max)
            }
            onClick={() => wybierz(c.date)}
            className={cn(
              "disabled:cursor-default disabled:text-faint-foreground disabled:hover:bg-transparent",
              "h-[30px] cursor-pointer rounded-md border border-transparent bg-transparent p-0 font-mono text-xs text-foreground hover:bg-muted",
              !c.inMonth && "text-faint-foreground",
              c.date === dzis && "border-border-strong",
              c.date === value && "bg-primary text-white hover:bg-primary",
            )}
          >
            {Number(c.date.slice(8))}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between border-t border-border pt-1.5">
        <button
          type="button"
          disabled={dzisPozaZakresem}
          onClick={() => wybierz(today ?? todayIso())}
          className="cursor-pointer rounded-md px-2 py-1 text-xs text-soft-foreground hover:bg-muted disabled:cursor-default disabled:text-faint-foreground disabled:hover:bg-transparent"
        >
          Dziś
        </button>
        <button
          type="button"
          onClick={() => wybierz(null)}
          className="cursor-pointer rounded-md px-2 py-1 text-xs text-soft-foreground hover:bg-muted"
        >
          Wyczyść
        </button>
      </div>
    </ActionPopover>
  );
}
