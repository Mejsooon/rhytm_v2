"use client";

// Siatka godzin dla widoku tygodnia i dnia (web) wg Calendar.dc.html i CalendarDay.dc.html.
// Cała doba 00–24, przewinięta przy montażu do 06:00 albo do trwającego bloku.
// Pozycje bloków to czas ścienny (startMin), więc nie zależą od stref.
import { useEffect, useRef, useState } from "react";

import type { IsoDate } from "@/components/controls/calendar-math";
import { occurrenceProgress, type TaskRow } from "@/features/tasks/model";
import { formatClockTime } from "@/lib/time/timezones";
import { layoutDay, nowLine } from "./day-layout";
import type { CategoryRow } from "./load-calendar";
import type { Occurrence } from "./occurrences";
import { weekdayOf } from "./view-range";

// Wysokość godziny w px: tydzień 48 (Calendar.dc.html), dzień 52 (CalendarDay.dc.html)
const GODZINA = { week: 48, day: 52 };
// Blok bez kategorii
const KOLOR_BRAK = "#a3a3a3";

const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const DNI_PELNE = ["", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const MIESIACE_DOPELNIACZ = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

export function TimeGrid({
  days,
  occurrences,
  categories,
  tasks,
  clock,
  today,
  nowMinutes,
  variant,
  totalCount,
  onSlotClick,
  onBlockClick,
}: {
  days: IsoDate[];
  // Wystąpienia widocznych kategorii w zakresie dni
  occurrences: Occurrence[];
  categories: CategoryRow[];
  tasks: TaskRow[];
  clock: "24" | "12";
  today: IsoDate;
  nowMinutes: number;
  variant: "week" | "day";
  // Widok dnia: ile bloków ma dzień łącznie (z ukrytymi kategoriami) do „x z y bloków”
  totalCount?: number;
  onSlotClick: (date: IsoDate, startMin: number) => void;
  onBlockClick: (key: string, anchorEl: HTMLElement) => void;
}) {
  const wysokoscGodziny = GODZINA[variant];
  const wysokoscSiatki = 24 * wysokoscGodziny;
  const szerokoscEtykiet = variant === "week" ? 56 : 64;
  const kolumny = `${szerokoscEtykiet}px repeat(${days.length}, minmax(0, 1fr))`;
  const przewijanie = useRef<HTMLDivElement>(null);
  // Półgodzina pod kursorem (duch „+ 10:00–11:00”)
  const [duch, setDuch] = useState<{ date: IsoDate; startMin: number } | null>(null);

  // Przy montażu: do trwającego bloku z dzisiejszej kolumny, a gdy go nie ma — do 06:00
  useEffect(() => {
    const trwajacy = occurrences.find(
      (o) =>
        o.date === today &&
        o.startMin <= nowMinutes &&
        nowMinutes < o.startMin + o.durationMin,
    );
    const odMinuty = trwajacy && days.includes(today) ? trwajacy.startMin : 6 * 60;
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
          (e.clientY - e.currentTarget.getBoundingClientRect().top) / (wysokoscGodziny / 2),
        ),
      ),
    );

  const godziny = Array.from({ length: 24 }, (_, h) => h);
  const tloLinii = `repeating-linear-gradient(to bottom, transparent 0, transparent ${wysokoscGodziny - 1}px, #f0f0f0 ${wysokoscGodziny - 1}px, #f0f0f0 ${wysokoscGodziny}px)`;

  // Tytuł dnia: „Wtorek, 17 listopada” i „x z y bloków”
  let naglowekDnia = null;
  if (variant === "day") {
    const [, miesiac, dzien] = days[0].split("-").map(Number);
    const wDniu = occurrences.filter((o) => o.date === days[0]);
    naglowekDnia = (
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <h2 className="text-lg font-semibold">
          {`${DNI_PELNE[weekdayOf(days[0])]}, ${dzien} ${MIESIACE_DOPELNIACZ[miesiac - 1]}`}
        </h2>
        <span className="font-mono text-xs text-[#6b6b6b]">
          {`${wDniu.length} z ${totalCount ?? wDniu.length} bloków`}
        </span>
      </div>
    );
  }

  return (
    <div>
      {naglowekDnia}
      <div className="overflow-x-auto">
        <div
          className={`rounded-lg border border-[#eaeaea] ${variant === "week" ? "min-w-[760px]" : ""}`}
        >
          <div
            ref={przewijanie}
            data-testid="przewijanie"
            className="max-h-[calc(100vh-260px)] min-h-[320px] overflow-y-auto"
          >
            {variant === "week" && (
              <>
                {/* Nagłówki dni; dziś wyróżniony na zielono jak w mini kalendarzu */}
                <div
                  className="sticky top-0 z-20 grid border-b border-[#eaeaea] bg-[#fafafa]"
                  style={{ gridTemplateColumns: kolumny }}
                >
                  <div />
                  {days.map((dzien) => {
                    const jestDzis = dzien === today;
                    return (
                      <div
                        key={dzien}
                        data-testid={`naglowek-${dzien}`}
                        className={`border-l border-[#eaeaea] px-2.5 py-2 ${
                          jestDzis ? "bg-[#f0faf4] text-[#15803d]" : ""
                        }`}
                      >
                        <span className={`font-mono text-[11px] ${jestDzis ? "" : "text-[#6b6b6b]"}`}>
                          {DNI_KROTKO[weekdayOf(dzien)]}
                        </span>{" "}
                        <span className={jestDzis ? "font-semibold" : "font-medium"}>
                          {Number(dzien.split("-")[2])}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Wiersz „Cały dzień” — w Etapie 2 pusty */}
                <div
                  className="grid border-b border-[#eaeaea]"
                  style={{ gridTemplateColumns: kolumny }}
                >
                  <div className="px-1.5 py-2 text-right font-mono text-[10px] text-[#6b6b6b]">
                    Cały dzień
                  </div>
                  {days.map((dzien) => (
                    <div key={dzien} className="min-h-[30px] border-l border-[#eaeaea] p-1.5" />
                  ))}
                </div>
              </>
            )}

            <div className="grid" style={{ gridTemplateColumns: kolumny }}>
              <div>
                {godziny.map((h) => (
                  <div
                    key={h}
                    className="box-border px-2 py-[3px] text-right font-mono text-[10px] text-[#6b6b6b]"
                    style={{ height: wysokoscGodziny }}
                  >
                    {/* Tryb 12h: krótka etykieta „5 PM” (formatClockTime dałby „5:00 PM”) */}
                    {clock === "12"
                      ? `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`
                      : formatClockTime(h, 0, "24")}
                  </div>
                ))}
              </div>

              {days.map((dzien) => {
                const dnia = occurrences.filter((o) => o.date === dzien);
                const uklad = layoutDay(dnia);
                const linia = nowLine({ date: today, minutes: nowMinutes }, dzien);
                const pokazDucha = duch?.date === dzien;
                return (
                  <div
                    key={dzien}
                    data-testid={`kolumna-${dzien}`}
                    className="relative cursor-pointer border-l border-[#eaeaea]"
                    style={{ height: wysokoscSiatki, backgroundImage: tloLinii }}
                    onClick={(e) => {
                      // Klik w blok i w ramkę pustego dnia obsługują własne przyciski
                      if ((e.target as HTMLElement).closest("button,a,[role=dialog]")) return;
                      onSlotClick(dzien, polgodzinaZ(e) * 30);
                    }}
                    onMouseMove={(e) => {
                      if ((e.target as HTMLElement).closest("button,a,[role=dialog]")) {
                        if (duch) setDuch(null);
                        return;
                      }
                      const startMin = polgodzinaZ(e) * 30;
                      if (duch?.date !== dzien || duch.startMin !== startMin) {
                        setDuch({ date: dzien, startMin });
                      }
                    }}
                    onMouseLeave={() => setDuch(null)}
                  >
                    {pokazDucha && duch && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute right-1 left-1 box-border rounded-md border border-dashed border-[#a3a3a3] bg-[#fafafa] px-2 py-1 font-mono text-[11px] text-[#666666]"
                        style={{
                          top: (duch.startMin / 60) * wysokoscGodziny + 2,
                          height: wysokoscGodziny - 4,
                        }}
                      >
                        {`+ ${formatClockTime(Math.floor(duch.startMin / 60), duch.startMin % 60, clock)}`}
                      </div>
                    )}

                    <div
                      className={`absolute inset-y-0 ${variant === "week" ? "right-0 left-0" : "right-3 left-2"}`}
                    >
                      {dnia.map((o) => {
                        const pozycja = uklad.find((u) => u.key === o.key);
                        const kolumna = pozycja?.col ?? 0;
                        const kolumn = pozycja?.cols ?? 1;
                        const kategoria = categories.find((k) => k.id === o.categoryId);
                        const kolor = kategoria?.color ?? KOLOR_BRAK;
                        // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
                        const dataOryginalna = o.key.slice(o.blockId.length + 1);
                        const postep = occurrenceProgress(tasks, o.blockId, dataOryginalna);
                        // Blok nie wychodzi poza dolną krawędź siatki
                        const czas = Math.min(o.durationMin, 1440 - o.startMin);
                        const koniec = o.startMin + czas;
                        const godzinyBloku = `${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`;
                        const licznik = postep.total > 0 ? `${postep.done}/${postep.total}` : "";
                        const cykliczny = o.recurring ? "↻" : "";
                        // Bloki krótsze niż 45 min: jedna linia bez pionowych odstępów
                        const kompakt = czas < 45;
                        return (
                          <div
                            key={o.key}
                            data-testid={`blok-${o.key}`}
                            className={`absolute box-border px-1${kompakt ? "" : " py-0.5"}`}
                            style={{
                              top: (o.startMin / 60) * wysokoscGodziny,
                              height: (czas / 60) * wysokoscGodziny,
                              left: `${(kolumna / kolumn) * 100}%`,
                              width: `${100 / kolumn}%`,
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => onBlockClick(o.key, e.currentTarget)}
                              title={`${o.title} ${godzinyBloku}`}
                              className={`box-border flex h-full w-full cursor-pointer flex-col items-stretch overflow-hidden rounded-md px-2 text-left text-[#171717] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#171717] ${kompakt ? "justify-center py-0" : "py-[5px]"}`}
                              style={{
                                background: `${kolor}14`,
                                border: `1px solid ${kolor}40`,
                                borderLeft: `3px solid ${kolor}`,
                                // Kompakt: bez górnej i dolnej ramki, żeby linia 11 px się zmieściła
                                ...(kompakt ? { borderTopWidth: 0, borderBottomWidth: 0 } : {}),
                              }}
                            >
                              {kompakt ? (
                                <span className="block truncate text-[11px] leading-none font-medium">
                                  {`${o.title} · ${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}`}
                                </span>
                              ) : variant === "week" ? (
                                <>
                                  <span className="block truncate text-xs leading-[1.3] font-medium">
                                    {o.title}
                                  </span>
                                  <span className="mt-0.5 block truncate font-mono text-[10px] text-[#404040]">
                                    {[godzinyBloku, licznik, cykliczny].filter(Boolean).join(" · ")}
                                  </span>
                                </>
                              ) : (
                                <span className="flex items-baseline gap-2.5 text-[13px] leading-[1.3]">
                                  <span className="font-medium">{o.title}</span>
                                  <span className="font-mono text-[11px] text-[#404040]">
                                    {`${godzinyBloku} · ${kategoria?.name ?? "Bez kategorii"}`}
                                  </span>
                                  {cykliczny && (
                                    <span className="font-mono text-[11px] text-[#404040]">{cykliczny}</span>
                                  )}
                                  <span className="ml-auto font-mono text-[11px] text-[#404040]">
                                    {licznik}
                                  </span>
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {variant === "day" && dnia.length === 0 && (totalCount ?? 0) === 0 && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-40 right-4 left-2 rounded-lg border border-dashed border-[#e0e0e0] bg-white p-6 text-center text-[#666666]">
                        Brak bloków w tym dniu.{" "}
                        <button
                          type="button"
                          onClick={() => onSlotClick(dzien, 8 * 60)}
                          className="cursor-pointer text-[#171717] underline hover:text-black"
                        >
                          Dodaj blok
                        </button>
                      </div>
                    )}

                    {linia !== null && (
                      <>
                        <div
                          data-testid="linia-teraz"
                          className="pointer-events-none absolute right-0 left-0 border-t-2 border-[#b91c1c]"
                          style={{ top: (linia / 60) * wysokoscGodziny }}
                        />
                        {variant === "day" && (
                          <span
                            className="pointer-events-none absolute -left-[58px] rounded bg-[#b91c1c] px-1 py-px font-mono text-[10px] text-white"
                            style={{ top: (linia / 60) * wysokoscGodziny - 9 }}
                          >
                            {formatClockTime(Math.floor(linia / 60), linia % 60, clock)}
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
      </div>
    </div>
  );
}
