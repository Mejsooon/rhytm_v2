"use client";

import * as React from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "./button";
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
// Skróty dnia tygodnia na wyzwalaczu („wt 17.11.2026” z CBlockDialog.dc.html); indeks = getUTCDay (0 = niedziela)
const DNI_WYZWALACZ = ["nd", "pn", "wt", "śr", "czw", "pt", "sob"];

// Wybór daty wg kalendarza z makiet S2 (S2Books.dc.html): dymek 256 px, nagłówek z miesiącem,
// siatka 7 kolumn tylko z dniami miesiąca, stopka „Dziś” / „Wyczyść”. Wybór dnia zamyka dymek.
// Wyzwalacz „box” jak .igroup z CBlockDialog.dc.html: ikona kalendarza po lewej i data sans z dniem tygodnia.
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
  className,
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
  // „bare”: goły tekst bez ramki i strzałki, krój i cyfry tabelaryczne jak w komórce .td.num z S2Books.dc.html
  variant?: "box" | "bare";
  // „sm”: przycisk 28 px, ikona 14 px i tekst 12 px sans (btnBase z Books.dc.html, tryb edycji wiersza)
  size?: "md" | "sm";
  // Dodatkowe klasy wyzwalacza (np. w-full w oknie bloku)
  className?: string;
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

  // Pełne tygodnie z dniami tego miesiąca; tydzień w całości z następnego miesiąca odpada
  const siatka = open
    ? buildMonthGrid(widok.rok, widok.miesiac, weekStart).filter(
        (_, i, wszystkie) => wszystkie.slice(i - (i % 7), i - (i % 7) + 7).some((c) => c.inMonth),
      )
    : [];
  // „Dziś” jest blokowane, gdy dzisiejszy dzień leży poza zakresem min–max
  const dzisPozaZakresem =
    (min !== undefined && dzis < min) || (max !== undefined && dzis > max);

  return (
    <ActionPopover
      open={open}
      onOpenChange={zmienOtwarcie}
      width={256}
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          className={cn(
            variant === "bare"
              ? "inline-flex min-h-5 cursor-pointer items-center rounded-sm border-0 bg-transparent p-0 font-[inherit] text-[13px] text-soft-foreground outline-none focus-visible:shadow-focus max-[799px]:min-h-11"
              : cn(
                  // .igroup: ramka input, promień 10 px, cień xs, ikona muted, tekst sans z cyframi tabelarycznymi
                  "inline-flex min-w-0 cursor-pointer items-center rounded-md border border-input bg-white bg-clip-padding text-left text-foreground tabular-nums shadow-xs outline-none transition-[box-shadow,border-color] duration-150 focus-visible:shadow-focus aria-expanded:border-ring aria-expanded:shadow-halo",
                  size === "sm"
                    ? "h-7 gap-1.5 px-2 text-xs whitespace-nowrap"
                    : "h-8 gap-2 px-[11px] text-sm max-[799px]:h-11",
                ),
            className,
          )}
        >
          {variant === "box" && (
            <CalendarIcon
              aria-hidden="true"
              className={cn(
                "flex-none text-muted-foreground",
                size === "sm" ? "size-3.5" : "size-4",
              )}
            />
          )}
          {value ? (
            variant === "bare" ? (
              <span className="min-w-0 truncate tabular-nums">{formatDatePl(value)}</span>
            ) : (
              <span className="min-w-0 truncate">
                {`${DNI_WYZWALACZ[new Date(`${value}T00:00:00Z`).getUTCDay()]} ${formatDatePl(value)}`}
              </span>
            )
          ) : (
            <span className={size === "sm" ? "text-muted-foreground" : "text-faint-foreground"}>{placeholder}</span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between pb-2">
        <Button
          size="sm"
          icon
          aria-label="Poprzedni miesiąc"
          onClick={() => przesun(-1)}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
        <span className="text-sm font-semibold">
          {monthTitlePl(widok.rok, widok.miesiac)}
        </span>
        <Button
          size="sm"
          icon
          aria-label="Następny miesiąc"
          onClick={() => przesun(1)}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 pb-1 text-center text-xs font-medium text-muted-foreground">
        {(weekStart === "mon" ? DNI_PN : DNI_ND).map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {siatka.map((c) =>
          // Dni spoza miesiąca: puste miejsce w siatce (makieta), bez przycisku
          !c.inMonth ? (
            <span key={c.date} aria-hidden="true" />
          ) : (
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
                "h-[30px] cursor-pointer rounded-lg border-0 bg-transparent p-0 text-[13px] text-foreground tabular-nums hover:bg-muted",
                // Dziś: szare tło i pogrubienie (makiety S2), wybrany dzień: czarne tło
                c.date === dzis && "bg-black/5 font-semibold",
                c.date === value && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
              )}
            >
              {Number(c.date.slice(8))}
            </button>
          ),
        )}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-2">
        <Button
          variant="ghost"
          size="xs"
          disabled={dzisPozaZakresem}
          onClick={() => wybierz(today ?? todayIso())}
        >
          Dziś
        </Button>
        <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => wybierz(null)}>
          Wyczyść
        </Button>
      </div>
    </ActionPopover>
  );
}
