"use client";

// Nagłówek kalendarza.
// Web (CCalendar.dc.html, CCalendarDay.dc.html): jeden pasek — zgrupowane ‹ Dziś › z tytułem
// i szarą plakietką (tydz. N / N z M bloków) po lewej, „Kategorie”, segment Dzień/Tydzień/Miesiąc
// i „Nowy blok” po prawej.
// Telefon (MCalendarDayFull.dc.html): jedna linia „Listopad” + „tydz. N”, ikona Kategorie i strzałki,
// segment pod spodem. Nowy blok na telefonie dodaje pływający przycisk widoku.
// Oba układy są w DOM, przełącza je CSS (800 px).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { SidebarToggle } from "@/components/shell/sidebar-toggle";
import {
  Button,
  MonoLabel,
  Segment,
  StatusBadge,
} from "@/components/controls";
import { MIESIACE, type IsoDate } from "@/components/controls/calendar-math";
import { CategoryFilters, CategorySheet } from "./category-filters";
import type { CategoryRow, RenewalSource } from "./load-calendar";
import { DNI_PELNE, MIESIACE_DOP } from "./mobile/pl";
import {
  isoWeekNumber,
  shiftDate,
  viewRange,
  weekdayOf,
  type CalendarView,
} from "./view-range";

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
  renewalSources = [],
  onToggleRenewalSource = () => {},
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
  // Źródła odnowień subskrypcji w menu „Kategorie” (pod kategoriami)
  renewalSources?: RenewalSource[];
  onToggleRenewalSource?: (source: RenewalSource) => void;
  onNewBlock?: () => void;
}) {
  const router = useRouter();
  const [rok, miesiac, numerDnia] = date.split("-").map(Number);
  const nazwaMiesiaca = MIESIACE[miesiac - 1];
  const miesiacWielka =
    nazwaMiesiaca.charAt(0).toUpperCase() + nazwaMiesiaca.slice(1);

  // Tytuł web: dzień „Wtorek, 17 listopada”, tydzień i miesiąc „Listopad 2026”
  const tytul =
    view === "dzien"
      ? `${DNI_PELNE[weekdayOf(date)]}, ${numerDnia} ${MIESIACE_DOP[miesiac - 1]}`
      : `${miesiacWielka} ${rok}`;
  // Numer ISO tygodnia liczymy ze środka tygodnia (przy tygodniu od niedzieli niedziela należy do poprzedniego)
  const podtytul =
    view === "tydzien"
      ? `tydz. ${isoWeekNumber(viewRange("tydzien", date, weekStart).days[3])}`
      : subtitle;

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
      <header className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-border px-4 py-2.5 max-[799px]:hidden">
        <div className="flex items-center gap-1.5">
          {/* Przy schowanym pasku: przycisk „Pokaż pasek boczny” przed okruszkami */}
          <SidebarToggle placement="header" />
          {/* Grupa ‹ Dziś ›: przyciski sklejone, zaokrąglone tylko skrajne rogi; fokus nad sąsiadem */}
          <div className="inline-flex">
            <Button
              asChild
              icon
              className="rounded-r-none focus-visible:z-10"
            >
              <Link
                href={adres(view, shiftDate(view, date, -1))}
                aria-label={`Poprzedni ${OKRES[view]}`}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild className="-ml-px rounded-none focus-visible:z-10">
              <Link href={adres(view, today)}>Dziś</Link>
            </Button>
            <Button
              asChild
              icon
              className="-ml-px rounded-l-none focus-visible:z-10"
            >
              <Link
                href={adres(view, shiftDate(view, date, 1))}
                aria-label={`Następny ${OKRES[view]}`}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <h1 className="ml-2 text-base font-semibold">{tytul}</h1>
          {podtytul && (
            <StatusBadge tone="gray" className="tabular-nums">
              {podtytul}
            </StatusBadge>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <CategoryFilters
            categories={categories}
            onToggle={onToggleCategory}
            onAdd={onAddCategory}
            sources={renewalSources}
            onToggleSource={onToggleRenewalSource}
          />
          {segment(view)}
          <Button variant="primary" onClick={onNewBlock}>
            <Plus size={16} aria-hidden="true" />
            Nowy blok
          </Button>
        </div>
      </header>

      <div className="flex-none min-[800px]:hidden">
        <header className="flex min-h-[52px] items-center gap-0.5 pt-2 pr-2 pb-1 pl-4">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
              {miesiacWielka}
            </h2>
            <MonoLabel>
              {mobileView === "miesiac"
                ? `${rok}`
                : `tydz. ${isoWeekNumber(date)}`}
            </MonoLabel>
          </div>
          <CategorySheet
            categories={categories}
            onToggle={onToggleCategory}
            onAdd={onAddCategory}
            sources={renewalSources}
            onToggleSource={onToggleRenewalSource}
          />
          <button
            type="button"
            aria-label={`Poprzedni ${OKRES[mobileView]}`}
            onClick={() =>
              router.push(adres(mobileView, shiftDate(mobileView, date, -1)))
            }
            className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Następny ${OKRES[mobileView]}`}
            onClick={() =>
              router.push(adres(mobileView, shiftDate(mobileView, date, 1)))
            }
            className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="mx-4 mb-2">{segment(mobileView)}</div>
      </div>
    </>
  );
}
