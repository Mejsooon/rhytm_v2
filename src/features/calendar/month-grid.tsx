"use client";

// Siatka miesiąca (web) wg CalendarMonth.dc.html: 6 tygodni, w komórce numer dnia i do 3 wpisów
// (kropka koloru, godzina, tytuł), reszta jako link „+N więcej” do widoku dnia.
import Link from "next/link";

import type { IsoDate } from "@/components/controls/calendar-math";
import { formatClockTime } from "@/lib/time/timezones";
import type { CategoryRow } from "./load-calendar";
import type { Occurrence } from "./occurrences";
import { weekdayOf } from "./view-range";

const KOLOR_BRAK = "#a3a3a3";
const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const MAX_WPISOW = 3;

export function MonthGrid({
  days,
  month0,
  occurrences,
  categories,
  today,
  clock,
  activeEntryKey,
  activeDay,
  onDayClick,
  onEntryClick,
}: {
  // 42 dni siatki (6 tygodni), od pierwszego dnia tygodnia
  days: IsoDate[];
  month0: number;
  // Tylko widoczne wystąpienia (bez ukrytych kategorii), z datą, na której mają stać w siatce
  occurrences: Occurrence[];
  categories: CategoryRow[];
  today: IsoDate;
  clock: "24" | "12";
  // Wpis z otwartym dymkiem i dzień z otwartym „Nowy wpis” dostają obwódkę
  activeEntryKey?: string | null;
  activeDay?: IsoDate | null;
  onDayClick: (date: IsoDate, anchor: HTMLElement) => void;
  onEntryClick: (key: string, anchor: HTMLElement) => void;
}) {
  // Wystąpienia pogrupowane po dniu (kolejność z expandOccurrences: godzina rosnąco)
  const poDniach = new Map<IsoDate, Occurrence[]>();
  for (const o of occurrences) {
    const lista = poDniach.get(o.date) ?? [];
    lista.push(o);
    poDniach.set(o.date, lista);
  }
  const koloryKategorii = new Map(categories.map((k) => [k.id, k.color]));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] rounded-lg border border-[#eaeaea]">
        <div className="grid grid-cols-7 rounded-t-lg border-b border-[#eaeaea] bg-[#fafafa] font-mono text-[11px] text-[#6b6b6b]">
          {days.slice(0, 7).map((dzien, i) => (
            <span
              key={dzien}
              data-testid="nazwa-dnia"
              className={`px-2.5 py-2 ${i > 0 ? "border-l border-[#eaeaea]" : ""}`}
            >
              {DNI_KROTKO[weekdayOf(dzien)]}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((dzien, i) => {
            const [, m, d] = dzien.split("-").map(Number);
            const wMiesiacu = m - 1 === month0;
            const weekend = weekdayOf(dzien) >= 6;
            const wpisy = poDniach.get(dzien) ?? [];
            const kiedy = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
            const numerKlasy = !wMiesiacu
              ? "text-[#a3a3a3]"
              : dzien === today
                ? "rounded bg-[#15803d] px-[5px] font-semibold text-white"
                : "font-medium text-[#171717]";

            return (
              <div
                key={dzien}
                data-testid={`komorka-${dzien}`}
                // Klik w pustą część komórki (wpisy i linki obsługują się same)
                onClick={(e) => {
                  if (e.target instanceof Element && e.target.closest("button, a")) return;
                  onDayClick(dzien, e.currentTarget);
                }}
                className={`group relative min-h-28 cursor-pointer px-2 py-1.5 ${i >= 7 ? "border-t border-[#eaeaea]" : ""} ${i % 7 > 0 ? "border-l border-[#eaeaea]" : ""} ${!wMiesiacu || weekend ? "bg-[#fafafa]" : ""} ${activeDay === dzien ? "ring-2 ring-[#171717] ring-inset" : ""}`}
              >
                <span
                  data-testid={`numer-${dzien}`}
                  className={`inline-block font-mono text-xs ${numerKlasy}`}
                >
                  {d}
                </span>
                <button
                  type="button"
                  aria-label={`Nowy wpis ${kiedy}`}
                  onClick={(e) => {
                    const komorka = e.currentTarget.closest<HTMLElement>("[data-testid^='komorka-']");
                    if (komorka) onDayClick(dzien, komorka);
                  }}
                  className="absolute top-1.5 right-2 flex size-5 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-sm text-[#666666] opacity-0 outline-none group-hover:bg-[#f0f0f0] group-hover:opacity-100 focus-visible:bg-[#f0f0f0] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#171717]/20"
                >
                  <span aria-hidden="true">+</span>
                </button>
                {wpisy.slice(0, MAX_WPISOW).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    data-occurrence-key={o.key}
                    aria-expanded={activeEntryKey === o.key}
                    onClick={(e) => onEntryClick(o.key, e.currentTarget)}
                    className={`mt-[3px] flex w-full cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent px-1.5 py-0.5 text-left text-[11px] text-[#171717] outline-none hover:bg-[#f0f0f0] focus-visible:ring-2 focus-visible:ring-[#171717]/30 ${activeEntryKey === o.key ? "ring-2 ring-[#171717]" : ""}`}
                  >
                    <span
                      aria-hidden="true"
                      data-testid={`kropka-${o.key}`}
                      className="size-2 flex-none rounded-full"
                      style={{ backgroundColor: (o.categoryId && koloryKategorii.get(o.categoryId)) || KOLOR_BRAK }}
                    />
                    <span className="flex-none font-mono text-[#6b6b6b]">
                      {formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}
                    </span>
                    <span className="min-w-0 truncate">{o.title}</span>
                  </button>
                ))}
                {wpisy.length > MAX_WPISOW && (
                  <Link
                    href={`/kalendarz?widok=dzien&data=${dzien}`}
                    className="mt-[3px] block font-mono text-[10px] text-[#6b6b6b] hover:text-[#171717]"
                  >
                    {`+${wpisy.length - MAX_WPISOW} więcej`}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
