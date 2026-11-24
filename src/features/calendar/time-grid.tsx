"use client";

// Siatka godzin dla widoku tygodnia i dnia (web) wg CCalendar.dc.html i CCalendarDay.dc.html.
// Siatka sama jest przewijanym elementem i wypełnia wysokość rodzica; nagłówek dni i „cały dzień”
// są przyklejone u góry. Cała doba 00–24, przewinięta przy montażu do 06:00 albo do trwającego bloku.
// Pozycje bloków to czas ścienny (startMin), więc nie zależą od stref.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Repeat } from "lucide-react";

import { StatusBadge } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { formatMoney } from "@/features/pages/fields";
import {
  SPORT_COLOR,
  sportItemHref,
  type SportItem,
} from "@/features/sport/model";
import { occurrenceProgress, type TaskRow } from "@/features/tasks/model";
import { formatClockTime } from "@/lib/time/timezones";
import { layoutDay, nowLine } from "./day-layout";
import type { DragResult } from "./drag";
import type { CategoryRow, RenewalItem } from "./load-calendar";
import type { Occurrence } from "./occurrences";
import { useGridDrag } from "./use-grid-drag";
import { weekdayOf } from "./view-range";

// Wysokość godziny w px: tydzień 48, dzień 52
const GODZINA = { week: 48, day: 52 };
// Blok bez kategorii
const KOLOR_BRAK = "#a3a3a3";

const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];

export function TimeGrid({
  days,
  occurrences,
  sport = [],
  categories,
  tasks,
  clock,
  today,
  nowMinutes,
  variant,
  totalCount,
  selectedKey,
  activeSlot,
  onSlotAnchor,
  onSlotClick,
  onBlockClick,
  onRangeDrag,
  onBlockDrag,
  renewals = [],
  openRenewalKey = null,
  onRenewalClick,
}: {
  days: IsoDate[];
  // Wystąpienia widocznych kategorii w zakresie dni
  occurrences: Occurrence[];
  // Podgląd treningów (tylko do odczytu): klik prowadzi na /sport, bez przeciągania
  sport?: SportItem[];
  categories: CategoryRow[];
  tasks: TaskRow[];
  clock: "24" | "12";
  today: IsoDate;
  nowMinutes: number;
  variant: "week" | "day";
  // Widok dnia: ile bloków ma dzień łącznie (z ukrytymi kategoriami); 0 pokazuje „Brak bloków”
  totalCount?: number;
  // Klucz wystąpienia z otwartym dymkiem: blok dostaje pierścień zaznaczenia
  selectedKey?: string | null;
  // Slot, dla którego jest otwarty dymek „Nowy wpis”: duch zostaje na nim mimo ruchu myszy
  activeSlot?: { date: IsoDate; startMin: number } | null;
  // Element ducha aktywnego slotu — kotwica dymku „Nowy wpis”
  onSlotAnchor?: (el: HTMLElement | null) => void;
  onSlotClick: (date: IsoDate, startMin: number) => void;
  onBlockClick: (key: string, anchorEl: HTMLElement) => void;
  // Przeciągnięcie po pustej siatce: zakres do utworzenia bloku
  onRangeDrag?: (range: DragResult) => void;
  // Przesunięcie albo rozciągnięcie bloku: nowe miejsce wystąpienia
  onBlockDrag?: (occurrence: Occurrence, result: DragResult) => void;
  // Odnowienia subskrypcji (tylko podgląd) w wierszu „cały dzień”; otwarte ma ciemniejszą ramkę
  renewals?: RenewalItem[];
  openRenewalKey?: string | null;
  onRenewalClick?: (item: RenewalItem, anchorEl: HTMLElement) => void;
}) {
  const wysokoscGodziny = GODZINA[variant];
  const wysokoscSiatki = 24 * wysokoscGodziny;
  const szerokoscEtykiet = variant === "week" ? 56 : 64;
  const kolumny = `${szerokoscEtykiet}px repeat(${days.length}, minmax(0, 1fr))`;
  const przewijanie = useRef<HTMLDivElement>(null);
  // Półgodzina pod kursorem (duch „+ 10:00–11:00”)
  const [duchMyszy, setDuchMyszy] = useState<{
    date: IsoDate;
    startMin: number;
  } | null>(null);
  // Przeciąganie wskaźnikiem: podgląd zakresu/przesunięcia (logika w use-grid-drag.ts)
  const { podglad, zacznij, tlumKlik } = useGridDrag({
    korzen: przewijanie,
    wysokoscGodziny,
    onRange: onRangeDrag,
    onBlock: onBlockDrag,
  });

  // Przy montażu: do trwającego bloku z dzisiejszej kolumny, a gdy go nie ma — do 06:00
  useEffect(() => {
    const trwajacy = occurrences.find(
      (o) =>
        o.date === today &&
        o.startMin <= nowMinutes &&
        nowMinutes < o.startMin + o.durationMin,
    );
    const odMinuty =
      trwajacy && days.includes(today) ? trwajacy.startMin : 6 * 60;
    if (przewijanie.current) {
      przewijanie.current.scrollTop = (odMinuty / 60) * wysokoscGodziny;
    }
    // Tylko przy montażu i zmianie dni/wariantu — nie przewijamy na każdy upływ minuty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(","), variant]);

  // Półgodzina (0–47) pod wskaźnikiem w kolumnie dnia
  const polgodzinaZ = (e: React.MouseEvent<HTMLElement>) =>
    Math.max(
      0,
      Math.min(
        47,
        Math.floor(
          (e.clientY - e.currentTarget.getBoundingClientRect().top) /
            (wysokoscGodziny / 2),
        ),
      ),
    );

  const godziny = Array.from({ length: 24 }, (_, h) => h);

  // Wpis odnowienia wg S2Calendar (`renChip`): przerywana ramka, ikona Repeat 12 px, tekst
  // „Netflix · 43,00 zł” ucinany wielokropkiem; otwarty ma ramkę .4 i cień 2 px (S2CalendarRenewal)
  const wpisOdnowienia = (r: RenewalItem) => {
    const otwarte = openRenewalKey === r.key;
    return (
      <button
        key={r.key}
        type="button"
        data-renewal-key={r.key}
        aria-expanded={otwarte}
        title={`Odnowienie ze strony ${r.pageTitle} — tylko podgląd`}
        onClick={(e) => onRenewalClick?.(r, e.currentTarget)}
        className="box-border flex w-full min-w-0 cursor-pointer items-center gap-1 overflow-hidden rounded-[6px] border border-dashed bg-white px-1.5 py-[3px] text-left text-xs font-medium whitespace-nowrap text-[#404040] outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={{
          borderColor: otwarte ? "rgba(0,0,0,.4)" : "rgba(0,0,0,.24)",
          boxShadow: otwarte ? "0 0 0 2px rgba(0,0,0,.08)" : undefined,
        }}
      >
        <Repeat size={12} aria-hidden="true" className="flex-none" />
        <span className="min-w-0 truncate">
          {r.title +
            (r.amount !== null ? ` · ${formatMoney(r.amount)} zł` : "")}
        </span>
      </button>
    );
  };
  // Linia godziny na górze każdej godziny, pod etykietą z osi
  const tloLinii = `repeating-linear-gradient(to bottom, rgba(0,0,0,.05) 0, rgba(0,0,0,.05) 1px, transparent 1px, transparent ${wysokoscGodziny}px)`;

  return (
    // Jedyny przewijany element widoku: wypełnia wysokość rodzica (flex), nagłówek dni
    // i wiersz „cały dzień” są przyklejone u jego góry
    <div
      ref={przewijanie}
      data-testid="przewijanie"
      className={`min-h-0 min-w-0 flex-1 overflow-auto${podglad ? " select-none" : ""}`}
      // Kursor całej siatki podczas gestu
      style={
        podglad
          ? {
              cursor:
                podglad.kind === "resize"
                  ? "ns-resize"
                  : podglad.kind === "move"
                    ? "grabbing"
                    : "crosshair",
            }
          : undefined
      }
    >
      <div className={variant === "week" ? "min-w-[760px]" : ""}>
        <div className="sticky top-0 z-20 border-b border-border bg-background">
          {variant === "week" ? (
            <>
              {/* Nagłówki dni; dziś: numer w ciemnym kółku */}
              <div className="grid" style={{ gridTemplateColumns: kolumny }}>
                <div />
                {days.map((dzien) => {
                  const jestDzis = dzien === today;
                  return (
                    <div
                      key={dzien}
                      data-testid={`naglowek-${dzien}`}
                      className="flex items-center gap-1.5 border-l border-border-soft px-2.5 pt-2 pb-1.5"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {DNI_KROTKO[weekdayOf(dzien)]}
                      </span>
                      <span
                        data-dzis={jestDzis || undefined}
                        className={
                          jestDzis
                            ? "inline-flex size-6 items-center justify-center rounded-full bg-destructive-strong text-[13px] leading-none font-semibold tracking-normal text-white tabular-nums"
                            : "text-[13px] font-semibold"
                        }
                      >
                        {Number(dzien.split("-")[2])}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Wiersz „cały dzień”: odnowienia subskrypcji tego dnia (S2Calendar) */}
              <div
                className="grid border-t border-border-soft"
                style={{ gridTemplateColumns: kolumny }}
              >
                <div className="p-1.5 text-right text-[11px] leading-[1.2] text-muted-foreground">
                  cały
                  <br />
                  dzień
                </div>
                {days.map((dzien) => (
                  <div
                    key={dzien}
                    data-testid={`caly-dzien-${dzien}`}
                    className="flex min-h-7 min-w-0 flex-col gap-0.5 border-l border-border-soft p-1"
                  >
                    {renewals
                      .filter((r) => r.date === dzien)
                      .map(wpisOdnowienia)}
                  </div>
                ))}
              </div>
            </>
          ) : (
            // Dzień: „cały dzień” i numer dnia w jednym wierszu
            <div className="grid" style={{ gridTemplateColumns: kolumny }}>
              <div className="px-1.5 py-2 text-right text-[11px] leading-[1.2] text-muted-foreground">
                cały
                <br />
                dzień
              </div>
              <div
                data-testid={`naglowek-${days[0]}`}
                className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 border-l border-border-soft px-2 py-1.5"
              >
                <span
                  data-dzis={days[0] === today || undefined}
                  className={
                    days[0] === today
                      ? "inline-flex size-6 items-center justify-center rounded-full bg-destructive-strong text-[13px] leading-none font-semibold tracking-normal text-white tabular-nums"
                      : "text-[13px] font-semibold"
                  }
                >
                  {Number(days[0].split("-")[2])}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {DNI_KROTKO[weekdayOf(days[0])]}
                </span>
                {/* Odnowienia dnia za numerem i nazwą dnia (układ z tygodnia) */}
                {renewals
                  .filter((r) => r.date === days[0])
                  .map((r) => (
                    <span key={r.key} className="flex min-w-0 max-w-[260px]">
                      {wpisOdnowienia(r)}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid" style={{ gridTemplateColumns: kolumny }}>
          <div>
            {godziny.map((h) => (
              <div
                key={h}
                className="box-border -translate-y-[7px] px-2 text-right text-[11px] text-muted-foreground tabular-nums"
                style={{ height: wysokoscGodziny }}
              >
                {/* Etykieta siedzi na linii godziny; północ bez etykiety (styka się z nagłówkiem).
                    Tryb 12h: krótka etykieta „5 PM” (formatClockTime dałby „5:00 PM”) */}
                {h === 0
                  ? ""
                  : clock === "12"
                    ? `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`
                    : formatClockTime(h, 0, "24")}
              </div>
            ))}
          </div>

          {days.map((dzien) => {
            const dnia = occurrences.filter((o) => o.date === dzien);
            const treningi = sport.filter((i) => i.date === dzien);
            // Bloki i treningi dzielą szerokość przy nakładaniu
            const uklad = layoutDay([...dnia, ...treningi]);
            const linia = nowLine({ date: today, minutes: nowMinutes }, dzien);
            // Aktywny slot (otwarty dymek) ma pierwszeństwo przed duchem myszy, jak w makiecie
            const duch = podglad
              ? null
              : activeSlot?.date === dzien
                ? activeSlot
                : duchMyszy?.date === dzien
                  ? duchMyszy
                  : null;
            const duchAktywny = duch !== null && duch === activeSlot;
            return (
              <div
                key={dzien}
                data-testid={`kolumna-${dzien}`}
                data-kolumna={dzien}
                className="relative cursor-pointer border-l border-border-soft"
                // Dzisiejsza kolumna tygodnia ma ledwo widoczne szare tło (w dniu bez tła, jak w makiecie)
                style={{
                  height: wysokoscSiatki,
                  backgroundImage: tloLinii,
                  backgroundColor:
                    variant === "week" && dzien === today
                      ? "rgba(0,0,0,.015)"
                      : undefined,
                }}
                // Klik zaraz po przeciągnięciu nie otwiera dymku ani nie wybiera slotu
                onClickCapture={tlumKlik}
                onPointerDown={(e) => {
                  // Przeciąganie po pustym miejscu tworzy zakres; bloki i przyciski mają własne gesty
                  if (
                    (e.target as HTMLElement).closest(
                      "button,a,[role=dialog],[data-uchwyt]",
                    )
                  )
                    return;
                  zacznij(e, "create");
                }}
                onClick={(e) => {
                  // Klik w blok i w ramkę pustego dnia obsługują własne przyciski
                  if (
                    (e.target as HTMLElement).closest(
                      "button,a,[role=dialog],[data-uchwyt]",
                    )
                  )
                    return;
                  onSlotClick(dzien, polgodzinaZ(e) * 30);
                }}
                onMouseMove={(e) => {
                  if (
                    (e.target as HTMLElement).closest(
                      "button,a,[role=dialog],[data-uchwyt]",
                    )
                  ) {
                    if (duchMyszy) setDuchMyszy(null);
                    return;
                  }
                  const startMin = polgodzinaZ(e) * 30;
                  if (
                    duchMyszy?.date !== dzien ||
                    duchMyszy.startMin !== startMin
                  ) {
                    setDuchMyszy({ date: dzien, startMin });
                  }
                }}
                onMouseLeave={() => setDuchMyszy(null)}
              >
                {duch && (
                  <div
                    ref={duchAktywny ? onSlotAnchor : undefined}
                    aria-hidden="true"
                    // Jak w Dziś: najechanie rgba(0,0,0,.24) / .02; slot z otwartym „Nowym wpisem” .45 / .04.
                    // Położenie jak bloku: tydzień 3 px z boków, dzień 8 px z lewej i 16 px z prawej
                    className={`pointer-events-none absolute box-border border border-dashed font-medium text-soft-foreground tabular-nums ${variant === "week" ? "right-[3px] left-[3px] rounded-[8px] px-2 py-1 text-xs" : "right-4 left-2 rounded-md px-3 py-[7px] text-[13px]"} ${duchAktywny ? "border-black/[.45] bg-black/[.04]" : "border-black/[.24] bg-black/[.02]"}`}
                    style={{
                      top:
                        (duch.startMin / 60) * wysokoscGodziny +
                        (variant === "week" ? 1 : 2),
                      height: wysokoscGodziny - (variant === "week" ? 3 : 4),
                    }}
                  >
                    {`+ ${formatClockTime(Math.floor(duch.startMin / 60), duch.startMin % 60, clock)}–${formatClockTime(Math.floor(Math.min(duch.startMin + 60, 1440) / 60), Math.min(duch.startMin + 60, 1440) % 60, clock)}`}
                  </div>
                )}

                {podglad?.date === dzien && (
                  <div
                    data-testid="podglad-przeciagania"
                    aria-hidden="true"
                    // Zaznaczany zakres i przenoszony blok jak w Dziś: przerywana ramka rgba(0,0,0,.45), tło .04
                    className={`pointer-events-none absolute z-10 box-border overflow-hidden border border-dashed border-black/[.45] bg-black/[.04] font-medium text-soft-foreground tabular-nums ${variant === "week" ? "right-[3px] left-[3px] rounded-[8px] px-2 py-1 text-xs" : "right-4 left-2 rounded-md px-3 py-[7px] text-[13px]"}`}
                    style={{
                      top:
                        (podglad.startMin / 60) * wysokoscGodziny +
                        (variant === "week" ? 1 : 2),
                      height:
                        (podglad.durationMin / 60) * wysokoscGodziny -
                        (variant === "week" ? 3 : 4),
                    }}
                  >
                    {`${podglad.kind === "create" ? "Nowy blok · " : ""}${formatClockTime(Math.floor(podglad.startMin / 60), podglad.startMin % 60, clock)}–${formatClockTime(Math.floor((podglad.startMin + podglad.durationMin) / 60), (podglad.startMin + podglad.durationMin) % 60, clock)}`}
                  </div>
                )}

                <div
                  // Tydzień: pełna szerokość kolumny (bloki 3 px od krawędzi); dzień: 8 px z lewej, 16 px z prawej
                  className={`absolute inset-y-0 ${variant === "week" ? "right-0 left-0" : "right-3 left-1"}`}
                >
                  {dnia.map((o) => {
                    const pozycja = uklad.find((u) => u.key === o.key);
                    const kolumna = pozycja?.col ?? 0;
                    const kolumn = pozycja?.cols ?? 1;
                    const kategoria = categories.find(
                      (k) => k.id === o.categoryId,
                    );
                    const kolor = kategoria?.color ?? KOLOR_BRAK;
                    // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
                    const dataOryginalna = o.key.slice(o.blockId.length + 1);
                    const postep = occurrenceProgress(
                      tasks,
                      o.blockId,
                      dataOryginalna,
                    );
                    // Blok nie wychodzi poza dolną krawędź siatki
                    const czas = Math.min(o.durationMin, 1440 - o.startMin);
                    const koniec = o.startMin + czas;
                    const godzinyBloku = `${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`;
                    const licznik =
                      postep.total > 0 ? `${postep.done}/${postep.total}` : "";
                    const cykliczny = o.recurring ? "↻" : "";
                    // Jedna linia bez pionowych odstępów: w tygodniu bloki krótsze niż godzina
                    // (dwie linie nie mieszczą się w 48 px), w dniu krótsze niż 45 min
                    const kompakt = variant === "week" ? czas < 60 : czas < 45;
                    // Blok krótszy niż 30 min: bez górnej i dolnej ramki, żeby linia tekstu się zmieściła
                    const ciasny = czas < 30;
                    const zaznaczony = selectedKey === o.key;
                    return (
                      <div
                        key={o.key}
                        data-testid={`blok-${o.key}`}
                        // Odstępy wg makiet: tydzień 3 px z boków, 1 px nad i 2 px pod; dzień 4 px z boków, 2 px nad i pod.
                        // Krótki blok (kompakt) bez odstępów w pionie: przycisk zajmuje całą wysokość, jak dotąd
                        className={`absolute box-border focus-within:z-[2] ${zaznaczony ? "z-[1]" : ""} ${variant === "week" ? "px-[3px]" : "px-1"}${kompakt ? "" : variant === "week" ? " pt-px pb-0.5" : " py-0.5"}${podglad?.key === o.key ? " opacity-40" : ""}`}
                        style={{
                          top: (o.startMin / 60) * wysokoscGodziny,
                          height: (czas / 60) * wysokoscGodziny,
                          left: `${(kolumna / kolumn) * 100}%`,
                          width: `${100 / kolumn}%`,
                        }}
                      >
                        <button
                          type="button"
                          data-occurrence-key={o.key}
                          onClick={(e) => onBlockClick(o.key, e.currentTarget)}
                          // Przeciągnięcie przesuwa blok; ruch poniżej 4 px zostaje zwykłym klikiem
                          onPointerDown={(e) =>
                            zacznij(e, "move", { occurrence: o })
                          }
                          title={`${o.title} ${godzinyBloku}`}
                          // Fokus jako outline z odstępem: inline boxShadow zaznaczenia nie może go zasłonić
                          className={`box-border flex h-full w-full cursor-pointer flex-col items-stretch overflow-hidden text-left text-foreground outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${variant === "week" ? `rounded-[8px] px-2 ${kompakt ? "justify-center py-0" : "py-1"}` : `rounded-md px-3 ${kompakt ? "justify-center py-0" : "py-[7px]"}`}`}
                          style={{
                            // CCalendar: tło kolor+12, ramka 1 px kolor+4d, bez paska po lewej;
                            // zaznaczony ma pierścień 2 px biały + 4 px kolor+66
                            background: `${kolor}12`,
                            border: `1px solid ${kolor}4d`,
                            ...(ciasny
                              ? { borderTopWidth: 0, borderBottomWidth: 0 }
                              : {}),
                            boxShadow: zaznaczony
                              ? `0 0 0 2px #fff, 0 0 0 4px ${kolor}66`
                              : undefined,
                          }}
                        >
                          {kompakt ? (
                            <span
                              className={`block truncate leading-none font-medium ${variant === "week" ? "text-xs" : "text-[13px]"}`}
                            >
                              {`${o.title} · ${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}`}
                            </span>
                          ) : variant === "week" ? (
                            <>
                              <span className="block truncate text-[13px] leading-[1.3] font-medium">
                                {o.title}
                              </span>
                              <span className="mt-px block truncate text-[11px] leading-[14px] text-soft-foreground tabular-nums">
                                {[godzinyBloku, licznik, cykliczny]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </>
                          ) : (
                            // Jedna linia bez zawijania: przy wąskim bloku najpierw ucina się opis, potem tytuł
                            <span className="flex w-full min-w-0 items-center gap-2.5 text-sm leading-[1.3] whitespace-nowrap">
                              <span className="min-w-0 shrink truncate font-medium">
                                {o.title}
                              </span>
                              <span className="min-w-0 shrink-[4] truncate text-xs text-soft-foreground tabular-nums">
                                {`${godzinyBloku} · ${kategoria?.name ?? "Bez kategorii"}`}
                              </span>
                              {cykliczny && (
                                <span className="shrink-0 text-xs text-soft-foreground">
                                  {cykliczny}
                                </span>
                              )}
                              {licznik && (
                                <StatusBadge
                                  tone="outline"
                                  className="ml-auto shrink-0 tabular-nums"
                                >
                                  {licznik}
                                </StatusBadge>
                              )}
                            </span>
                          )}
                        </button>
                        {/* Dolny uchwyt rozciągania (tylko bloki ≥ 30 min, krótsze da się kliknąć i chwycić); klawiatura korzysta z edycji w dymku */}
                        {czas >= 30 && (
                          <div
                            data-testid={`uchwyt-${o.key}`}
                            data-uchwyt
                            aria-hidden="true"
                            onPointerDown={(e) =>
                              zacznij(e, "resize", { occurrence: o })
                            }
                            className="absolute right-1 bottom-0 left-1 h-1.5 cursor-ns-resize"
                          />
                        )}
                      </div>
                    );
                  })}
                  {treningi.map((i) => {
                    const pozycja = uklad.find((u) => u.key === i.key);
                    const kolumna = pozycja?.col ?? 0;
                    const kolumn = pozycja?.cols ?? 1;
                    const czas = Math.min(i.durationMin, 1440 - i.startMin);
                    const koniec = i.startMin + czas;
                    const godzinyTreningu = `${formatClockTime(Math.floor(i.startMin / 60), i.startMin % 60, clock)}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`;
                    const kompakt = variant === "week" ? czas < 60 : czas < 45;
                    const ciasny = czas < 30;
                    return (
                      <div
                        key={i.key}
                        data-testid={`sport-${i.key}`}
                        className={`absolute box-border ${variant === "week" ? "px-[3px]" : "px-1"}${kompakt ? "" : variant === "week" ? " pt-px pb-0.5" : " py-0.5"}`}
                        style={{
                          top: (i.startMin / 60) * wysokoscGodziny,
                          height: (czas / 60) * wysokoscGodziny,
                          left: `${(kolumna / kolumn) * 100}%`,
                          width: `${100 / kolumn}%`,
                        }}
                      >
                        {/* Link (nie przycisk): kolumna nie zaczyna na nim przeciągania, a klik
                            otwiera dymek treningu na /sport. Plan ma białe tło i przerywaną ramkę, wykonany jak blok */}
                        <Link
                          href={sportItemHref(i)}
                          data-planned={i.planned || undefined}
                          draggable={false}
                          title={`${i.title} ${godzinyTreningu}`}
                          className={`box-border flex h-full w-full flex-col items-stretch overflow-hidden text-left text-foreground outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${i.planned ? "bg-background" : ""} ${variant === "week" ? `rounded-[8px] px-2 ${kompakt ? "justify-center py-0" : "py-1"}` : `rounded-md px-3 ${kompakt ? "justify-center py-0" : "py-[7px]"}`}`}
                          style={{
                            ...(i.planned
                              ? {}
                              : { background: `${SPORT_COLOR}12` }),
                            border: i.planned
                              ? `1px dashed ${SPORT_COLOR}`
                              : `1px solid ${SPORT_COLOR}4d`,
                            ...(ciasny
                              ? { borderTopWidth: 0, borderBottomWidth: 0 }
                              : {}),
                          }}
                        >
                          {kompakt ? (
                            <span
                              className={`block truncate leading-none font-medium ${variant === "week" ? "text-xs" : "text-[13px]"}`}
                            >
                              {`${i.title} · ${formatClockTime(Math.floor(i.startMin / 60), i.startMin % 60, clock)}`}
                            </span>
                          ) : variant === "week" ? (
                            <>
                              <span className="block truncate text-[13px] leading-[1.3] font-medium">
                                {i.title}
                              </span>
                              <span className="mt-px block truncate text-[11px] leading-[14px] text-soft-foreground tabular-nums">
                                {godzinyTreningu}
                              </span>
                            </>
                          ) : (
                            <span className="flex w-full min-w-0 items-center gap-2.5 text-sm leading-[1.3] whitespace-nowrap">
                              <span className="min-w-0 shrink truncate font-medium">
                                {i.title}
                              </span>
                              <span className="min-w-0 shrink-[4] truncate text-xs text-soft-foreground tabular-nums">
                                {`${godzinyTreningu} · Sport`}
                              </span>
                            </span>
                          )}
                        </Link>
                      </div>
                    );
                  })}
                </div>

                {variant === "day" &&
                  dnia.length === 0 &&
                  treningi.length === 0 &&
                  (totalCount ?? 0) === 0 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-40 right-4 left-2 rounded-lg border border-dashed border-input bg-white p-6 text-center text-muted-foreground"
                    >
                      Brak bloków w tym dniu.{" "}
                      <button
                        type="button"
                        onClick={() => onSlotClick(dzien, 8 * 60)}
                        className="cursor-pointer text-foreground underline hover:text-black"
                      >
                        Dodaj blok
                      </button>
                    </div>
                  )}

                {linia !== null && (
                  <>
                    <div
                      data-testid="linia-teraz"
                      // Czerwona linia 2 px z kropką 8 px na lewym końcu, nad blokami
                      className="pointer-events-none absolute right-0 left-0 z-[3] border-t-2 border-destructive"
                      style={{ top: (linia / 60) * wysokoscGodziny }}
                    >
                      <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-destructive" />
                    </div>
                    {variant === "day" && (
                      <span
                        data-testid="etykieta-teraz"
                        // Jak na Dziś: biała na destructive-strong, promień 6 px, 11 px / 500
                        className="pointer-events-none absolute -left-[58px] z-[3] rounded-sm bg-destructive-strong px-[5px] py-0.5 text-[11px] font-medium text-white tabular-nums"
                        style={{ top: (linia / 60) * wysokoscGodziny - 10 }}
                      >
                        {formatClockTime(
                          Math.floor(linia / 60),
                          linia % 60,
                          clock,
                        )}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
