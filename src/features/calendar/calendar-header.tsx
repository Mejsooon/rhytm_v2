"use client";

// Nagłówek kalendarza: web wg Calendar.dc.html (‹ Dziś › + tytuł + segment + „Nowy blok”),
// telefon wg MCalendarDay.dc.html (etykieta, miesiąc, „+”, segment pod spodem).
// Oba układy są w DOM, przełącza je CSS (800 px).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button, MonoLabel, Segment } from "@/components/controls";
import { MIESIACE, type IsoDate } from "@/components/controls/calendar-math";
import { isoWeekNumber, shiftDate, viewRange, type CalendarView } from "./view-range";

const OPCJE_WIDOKU: { value: CalendarView; label: string }[] = [
  { value: "dzien", label: "Dzień" },
  { value: "tydzien", label: "Tydzień" },
  { value: "miesiac", label: "Miesiąc" },
];

const OKRES: Record<CalendarView, string> = {
  dzien: "dzień",
  tydzien: "tydzień",
  miesiac: "miesiąc",
};

function adres(view: CalendarView, date: IsoDate): string {
  return `/kalendarz?widok=${view}&data=${date}`;
}

// '2026-11-16' -> '16.11'
function dzienMiesiac(d: IsoDate): string {
  const [, m, dzien] = d.split("-");
  return `${Number(dzien)}.${m}`;
}

// „tydz. 47 · 16–22.11”; w widoku miesiąca bez etykiety
function etykietaTygodnia(
  view: CalendarView,
  date: IsoDate,
  weekStart: "mon" | "sun",
): string | null {
  if (view === "miesiac") return null;
  if (view === "dzien") {
    return `tydz. ${isoWeekNumber(date)} · ${dzienMiesiac(date)}`;
  }
  const { from, to, days } = viewRange("tydzien", date, weekStart);
  // Numer ISO liczymy ze środka tygodnia (przy tygodniu od niedzieli niedziela należy do poprzedniego)
  const numer = isoWeekNumber(days[3]);
  const [, mOd] = from.split("-");
  const [, mDo, dDo] = to.split("-");
  const zakres =
    mOd === mDo
      ? `${Number(from.split("-")[2])}–${Number(dDo)}.${mDo}`
      : `${dzienMiesiac(from)}–${dzienMiesiac(to)}`;
  return `tydz. ${numer} · ${zakres}`;
}

export function CalendarHeader({
  view,
  date,
  today,
  weekStart,
  onNewBlock,
}: {
  view: CalendarView;
  date: IsoDate;
  today: IsoDate;
  weekStart: "mon" | "sun";
  // Okno nowego bloku podepnie Task 8
  onNewBlock?: () => void;
}) {
  const router = useRouter();
  const [rok, miesiac] = date.split("-").map(Number);
  const nazwaMiesiaca = MIESIACE[miesiac - 1];
  const miesiacWielka = nazwaMiesiaca.charAt(0).toUpperCase() + nazwaMiesiaca.slice(1);
  const tydzien = etykietaTygodnia(view, date, weekStart);

  const segment = (
    <Segment
      ariaLabel="Widok kalendarza"
      value={view}
      options={OPCJE_WIDOKU}
      onChange={(v) => router.push(adres(v, date))}
    />
  );

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3 max-[799px]:hidden">
        <div className="flex items-center gap-2.5">
          <Button asChild size="sm" className="px-2 py-1.5">
            <Link href={adres(view, shiftDate(view, date, -1))} aria-label={`Poprzedni ${OKRES[view]}`}>
              ‹
            </Link>
          </Button>
          <Button asChild size="sm" className="px-2.5 py-1.5">
            <Link href={adres(view, today)}>Dziś</Link>
          </Button>
          <Button asChild size="sm" className="px-2 py-1.5">
            <Link href={adres(view, shiftDate(view, date, 1))} aria-label={`Następny ${OKRES[view]}`}>
              ›
            </Link>
          </Button>
          <h1 className="ml-1.5 text-lg font-semibold">{`${miesiacWielka} ${rok}`}</h1>
          {tydzien && <span className="font-mono text-xs text-[#6b6b6b]">{tydzien}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {segment}
          <Button variant="primary" size="sm" onClick={onNewBlock}>
            Nowy blok
          </Button>
        </div>
      </header>

      <div className="min-[800px]:hidden">
        <header className="flex min-h-[60px] items-center gap-1 pt-2 pr-2 pb-1 pl-4">
          <div className="min-w-0 flex-1">
            <MonoLabel className="block">
              {view === "miesiac" ? `${rok}` : `${rok} · tydzień ${isoWeekNumber(date)}`}
            </MonoLabel>
            <h2 className="mt-0.5 text-[28px] font-semibold tracking-[-0.02em]">{miesiacWielka}</h2>
          </div>
          <button
            type="button"
            aria-label="Nowy blok"
            onClick={onNewBlock}
            className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] text-[#171717] hover:bg-[#f5f5f5]"
          >
            <Plus size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="mx-4 mb-2">{segment}</div>
      </div>
    </>
  );
}
