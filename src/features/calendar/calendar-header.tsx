"use client";

// Nagłówek kalendarza.
// Web (CCalendar.dc.html, CCalendarDay.dc.html): jeden pasek — zgrupowane ‹ Dziś › z tytułem
// i szarą plakietką (tydz. N / N z M bloków) po lewej, „Kategorie”, segment Dzień/Tydzień/Miesiąc
// i „Nowy blok” po prawej.
// Telefon (CMCalendarDay/Week/Month.dc.html): dzień „Listopad” + „tydz. N” z ikonami Kategorie i Szukaj;
// tydzień etykieta „RRRR · tydzień N” + zakres dni, Szukaj, Nowy blok i strzałki; miesiąc etykieta roku + nazwa
// i strzałki; pod spodem segment widoków (linki). Kategorie na telefonie tylko w dniu (tydzień i miesiąc
// jak w makietach bez ikony). Nowy blok w dniu i miesiącu dodaje pływający przycisk widoku.
// Oba układy są w DOM, przełącza je CSS (800 px).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";

import { SidebarToggle } from "@/components/shell/sidebar-toggle";
import { Button, Segment, StatusBadge } from "@/components/controls";
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
  onAddCategoryPhone,
  onNewBlockPhone,
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
  // „+ Kategoria” w menu, „Kategoria” w arkuszu
  onAddCategory?: () => void;
  // Telefon: osobne wejścia (arkusz „Nowa kategoria”, „Nowy wpis”); bez nich działają te same co na webie
  onAddCategoryPhone?: () => void;
  onNewBlockPhone?: () => void;
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

  // Zakres dni tygodnia do nagłówka telefonu: „9–15 listopada” albo „28 listopada – 4 grudnia”
  const dniTygodnia = viewRange("tydzien", date, weekStart).days;
  const [, mPierwszy, dPierwszy] = dniTygodnia[0].split("-").map(Number);
  const [, mOstatni, dOstatni] = dniTygodnia[6].split("-").map(Number);
  const zakresTygodnia =
    mPierwszy === mOstatni
      ? `${dPierwszy}–${dOstatni} ${MIESIACE_DOP[mOstatni - 1]}`
      : `${dPierwszy} ${MIESIACE_DOP[mPierwszy - 1]} – ${dOstatni} ${MIESIACE_DOP[mOstatni - 1]}`;

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
            <Button asChild icon className="rounded-r-none focus-visible:z-10">
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
        {/* Nagłówek telefonu wg CM*: dzień „Listopad” + „tydz. N”, tydzień etykieta + zakres dni, miesiąc etykieta roku + nazwa */}
        <header className="m-head">
          {mobileView === "dzien" ? (
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <h2 className="m-title">{miesiacWielka}</h2>
              <span className="text-xs font-medium text-muted-foreground">
                {`tydz. ${isoWeekNumber(date)}`}
              </span>
            </div>
          ) : mobileView === "tydzien" ? (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-muted-foreground tabular-nums">
                {`${dniTygodnia[3].slice(0, 4)} · tydzień ${isoWeekNumber(dniTygodnia[3])}`}
              </div>
              <h2 className="m-title truncate">{zakresTygodnia}</h2>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-muted-foreground tabular-nums">
                {rok}
              </div>
              <h2 className="m-title">{miesiacWielka}</h2>
            </div>
          )}
          {mobileView === "dzien" && (
            <>
              <CategorySheet
                categories={categories}
                onToggle={onToggleCategory}
                onAdd={onAddCategoryPhone ?? onAddCategory}
                sources={renewalSources}
                onToggleSource={onToggleRenewalSource}
              />
              <Button variant="ghost" icon asChild>
                <Link href="/szukaj" aria-label="Szukaj">
                  <Search size={20} aria-hidden="true" />
                </Link>
              </Button>
            </>
          )}
          {mobileView === "tydzien" && (
            <>
              <Button variant="ghost" icon asChild>
                <Link href="/szukaj" aria-label="Szukaj">
                  <Search size={20} aria-hidden="true" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                icon
                aria-label="Nowy wpis"
                onClick={onNewBlockPhone ?? onNewBlock}
              >
                <Plus size={20} aria-hidden="true" />
              </Button>
            </>
          )}
          {/* Dzień ma nawigację w pasku tygodnia; tydzień i miesiąc mają strzałki */}
          {mobileView !== "dzien" && (
            <>
              <Button
                variant="ghost"
                icon
                aria-label={`Poprzedni ${OKRES[mobileView]}`}
                onClick={() =>
                  router.push(
                    adres(mobileView, shiftDate(mobileView, date, -1)),
                  )
                }
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                icon
                aria-label={`Następny ${OKRES[mobileView]}`}
                onClick={() =>
                  router.push(adres(mobileView, shiftDate(mobileView, date, 1)))
                }
              >
                <ChevronRight size={20} aria-hidden="true" />
              </Button>
            </>
          )}
        </header>
        {/* Segment widoków jako linki (.seg z makiety): aktualny widok ma aria-current="page" */}
        <nav
          aria-label="Widok kalendarza"
          className="mx-4 mt-3 mb-2 flex gap-0.5 rounded-md bg-muted p-0.5 text-sm"
        >
          {OPCJE_WIDOKU.map((opcja) => (
            <Link
              key={opcja.value}
              href={adres(opcja.value, date)}
              aria-current={opcja.value === mobileView ? "page" : undefined}
              className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center truncate rounded-[8px] px-2 font-medium no-underline outline-none focus-visible:shadow-focus ${
                opcja.value === mobileView
                  ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.05)]"
                  : "text-muted-foreground"
              }`}
            >
              {opcja.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
