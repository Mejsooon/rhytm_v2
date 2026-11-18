"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatClockTime } from "@/lib/time/timezones";
import { ActionPopover } from "./action-popover";

const GODZINY = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
// Tryb 12 h: siatka 1–12 (bez zera przed jedynką, jak na zegarze)
const GODZINY_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTY = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

const KOMORKA =
  "h-[30px] cursor-pointer rounded-md border border-transparent bg-transparent p-0 font-mono text-xs text-[#171717] hover:bg-[#f5f5f5] aria-pressed:bg-[#171717] aria-pressed:text-white";

// Wybór godziny wg .tmb / .tpop / .tgrid / .tcell z SettingsNotifications.dc.html.
// Klik godziny zostawia dymek otwarty, klik minut go zamyka.
// Tryb 12 h (spec 9.2): siatka 1–12 i przełącznik AM/PM; wartość zawsze zostaje 'HH:MM' (24 h).
export function TimePicker({
  value,
  onChange,
  ariaLabel,
  clock = "24",
  allowEndOfDay = false,
  disabled = false,
}: {
  value: string; // 'HH:MM'
  onChange: (v: string) => void;
  ariaLabel: string;
  clock?: "24" | "12";
  // Koniec doby: dodatkowa opcja „24:00” (tylko dla pola „do” bloku kończącego się o północy)
  allowEndOfDay?: boolean;
  // Wyłączony wybór (np. przypomnienie wyłączone): przycisk nie otwiera dymka
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [godzina, minuta] = value.split(":");
  const godzinaLiczba = Number(godzina);
  const pm = godzinaLiczba >= 12;
  const wTrybie12 = clock === "12";
  const koniecDoby = allowEndOfDay && value === "24:00";

  // 1–12 + AM/PM -> godzina 24 h ('12 AM' = 00, '12 PM' = 12)
  function zGodziny12(g12: number, popoludnie: boolean): string {
    return String((g12 % 12) + (popoludnie ? 12 : 0)).padStart(2, "0");
  }

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
          disabled={disabled}
          className={cn(
            "inline-flex h-[30px] max-[799px]:h-11 cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e0e0] bg-white px-2.5 font-mono text-[13px] text-[#171717] outline-none hover:border-[#cfcfcf] disabled:cursor-default disabled:opacity-45 disabled:hover:border-[#e0e0e0]",
            open && "border-[#171717] hover:border-[#171717]",
          )}
        >
          {wTrybie12
            ? formatClockTime(godzinaLiczba, Number(minuta), "12")
            : value}
          <ChevronDownIcon
            aria-hidden="true"
            className="size-3 flex-none text-[#666666]"
          />
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[11px] uppercase tracking-[.06em] text-[#6b6b6b]">
          Godzina
        </div>
        {wTrybie12 ? (
          <>
            <div className="grid grid-cols-6 gap-[3px]">
              {GODZINY_12.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={Number(g) === (godzinaLiczba % 12 || 12)}
                  onClick={() =>
                    onChange(`${zGodziny12(Number(g), pm)}:${minuta}`)
                  }
                  className={KOMORKA}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-[3px]">
              {[false, true].map((popoludnie) => (
                <button
                  key={popoludnie ? "PM" : "AM"}
                  type="button"
                  aria-pressed={pm === popoludnie}
                  // Zmiana AM/PM przesuwa godzinę o 12 h, minuty zostają
                  onClick={() =>
                    onChange(
                      `${zGodziny12(godzinaLiczba % 12 || 12, popoludnie)}:${minuta}`,
                    )
                  }
                  className={KOMORKA}
                >
                  {popoludnie ? "PM" : "AM"}
                </button>
              ))}
            </div>
          </>
        ) : (
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
        )}
        {allowEndOfDay && (
          <button
            type="button"
            aria-pressed={koniecDoby}
            onClick={() => {
              onChange("24:00");
              setOpen(false);
            }}
            className={KOMORKA}
          >
            {formatClockTime(24, 0, clock)}
          </button>
        )}
        <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[.06em] text-[#6b6b6b]">
          Minuty
        </div>
        <div className="grid grid-cols-6 gap-[3px]">
          {MINUTY.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={!koniecDoby && m === minuta}
              disabled={koniecDoby}
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
