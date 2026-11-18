"use client";

// Nagłówek kalendarza.
// Web (CalendarNotionWeek/Day.dc.html): jeden cienki pasek — ‹ Dziś › z tytułem po lewej,
// „Kategorie”, segment Dzień/Tydzień/Miesiąc i „Nowy blok” po prawej.
// Telefon (MCalendarDayFull.dc.html): jedna linia „Listopad” + „tydz. N”, ikona Kategorie i strzałki,
// segment pod spodem. Nowy blok na telefonie dodaje pływający przycisk widoku.
// Oba układy są w DOM, przełącza je CSS (800 px).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button, MonoLabel, Segment } from "@/components/controls";
import { MIESIACE, type IsoDate } from "@/components/controls/calendar-math";
import { CategoryFilters, CategorySheet } from "./category-filters";
import type { CategoryRow } from "./load-calendar";
import { DNI_PELNE, MIESIACE_DOP } from "./mobile/pl";
import { isoWeekNumber, shiftDate, viewRange, weekdayOf, type CalendarView } from "./view-range";

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

export function CalendarHeader({
  view,
  mobileView = view,
  date,
  today,
  weekStart,
  subtitle,
  categories = [],
  onToggleCategory = () => {},
  onAddCategory = () => {},
  onNewBlock,
}: {
  view: CalendarView;
  // Widok pokazywany na telefonie, gdy różni się od webowego (bez `widok` w adresie: dzień zamiast tygodnia)
  mobileView?: CalendarView;
  date: IsoDate;
  today: IsoDate;
  weekStart: "mon" | "sun";
  // Podtytuł obok tytułu w widoku dnia („N z M bloków”) i miesiąca („N wpisów widocznych”);
  // tydzień pokazuje numer tygodnia
  subtitle?: string;
  categories?: CategoryRow[];
  onToggleCategory?: (category: CategoryRow) => void;
  // „+ Kategoria” w menu i w arkuszu
  onAddCategory?: () => void;
  onNewBlock?: () => void;
}) {
  const router = useRouter();
  const [rok, miesiac, numerDnia] = date.split("-").map(Number);
  const nazwaMiesiaca = MIESIACE[miesiac - 1];
  const miesiacWielka = nazwaMiesiaca.charAt(0).toUpperCase() + nazwaMiesiaca.slice(1);

  // Tytuł web: dzień „Wtorek, 17 listopada”, tydzień i miesiąc „Listopad 2026”
  const tytul =
    view === "dzien"
      ? `${DNI_PELNE[weekdayOf(date)]}, ${numerDnia} ${MIESIACE_DOP[miesiac - 1]}`
      : `${miesiacWielka} ${rok}`;
  // Numer ISO tygodnia liczymy ze środka tygodnia (przy tygodniu od niedzieli niedziela należy do poprzedniego)
  const podtytul =
    view === "tydzien" ? `tydz. ${isoWeekNumber(viewRange("tydzien", date, weekStart).days[3])}` : subtitle;

  const segment = (wartosc: CalendarView) => (
    <Segment
      ariaLabel="Widok kalendarza"
      value={wartosc}
      options={OPCJE_WIDOKU}
      onChange={(v) => router.push(adres(v, date))}
    />
  );

  return (
    <>
      <header className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-[#eaeaea] px-4 py-2.5 max-[799px]:hidden">
        <div className="flex items-center gap-1.5">
          <Button asChild size="sm" className="px-2 py-[5px] text-[13px]">
            <Link href={adres(view, shiftDate(view, date, -1))} aria-label={`Poprzedni ${OKRES[view]}`}>
              ‹
            </Link>
          </Button>
          <Button asChild size="sm" className="px-2.5 py-[5px] text-[13px]">
            <Link href={adres(view, today)}>Dziś</Link>
          </Button>
          <Button asChild size="sm" className="px-2 py-[5px] text-[13px]">
            <Link href={adres(view, shiftDate(view, date, 1))} aria-label={`Następny ${OKRES[view]}`}>
              ›
            </Link>
          </Button>
          <h1 className="ml-2 text-base font-semibold">{tytul}</h1>
          {podtytul && <span className="font-mono text-xs text-[#6b6b6b]">{podtytul}</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <CategoryFilters categories={categories} onToggle={onToggleCategory} onAdd={onAddCategory} />
          {segment(view)}
          <Button variant="primary" size="sm" className="text-[13px]" onClick={onNewBlock}>
            Nowy blok
          </Button>
        </div>
      </header>

      <div className="flex-none min-[800px]:hidden">
        <header className="flex min-h-[52px] items-center gap-0.5 pt-2 pr-2 pb-1 pl-4">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{miesiacWielka}</h2>
            <MonoLabel>{mobileView === "miesiac" ? `${rok}` : `tydz. ${isoWeekNumber(date)}`}</MonoLabel>
          </div>
          <CategorySheet categories={categories} onToggle={onToggleCategory} onAdd={onAddCategory} />
          <button
            type="button"
            aria-label={`Poprzedni ${OKRES[mobileView]}`}
            onClick={() => router.push(adres(mobileView, shiftDate(mobileView, date, -1)))}
            className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] text-[#171717] hover:bg-[#f5f5f5]"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Następny ${OKRES[mobileView]}`}
            onClick={() => router.push(adres(mobileView, shiftDate(mobileView, date, 1)))}
            className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] text-[#171717] hover:bg-[#f5f5f5]"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="mx-4 mb-2">{segment(mobileView)}</div>
      </div>
    </>
  );
}
