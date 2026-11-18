"use client";

// Ekran „Nawyki i sen” na telefonie wg MHabits.dc.html: nagłówek z „+”, segment Nawyki / Sen.
// Nawyki: pierścień dnia, lista z dużym checkboxem (odhacza dziś przez wspólny store), heatmapa 4 tygodni.
// Sen: ostatnia noc i średnia, wykres 14/30 dni ze stuknięciem słupka, „Dodaj wpis snu”.
import { useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronRight, Moon, Plus } from "lucide-react";

import { Button, Segment } from "@/components/controls";
import { formatDatePl } from "@/components/controls/calendar-math";
import type { IsoDate } from "@/components/controls/calendar-math";
import { DNI_PELNE, MIESIACE_DOP } from "@/features/calendar/mobile/pl";
import { weekdayOf } from "@/features/calendar/view-range";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import type { HabitsPageData } from "../load-habits";
import {
  canCheck,
  currentStreak,
  dayStats,
  heatmapWeeks,
  longestStreak,
  scheduleOn,
  type Checks,
} from "../model";
import { sleepMinutes, sleepStats, type SleepLog } from "../sleep";
import { describeSchedule, formatDuration, streakLabel } from "../text";

const SKROTY_DNI = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];
const SAMOPOCZUCIE = ["Źle", "Słabo", "OK", "Dobrze", "Super"];
// Odcienie heatmapy z makiety (od braku do 100%)
const ODCIENIE = ["#f0f0f0", "#cdebd8", "#8fd1a8", "#3fa66b", "#15803d", "#0f5f2e"];
const WYSOKOSC_WYKRESU = 140; // px
const OBWOD_PIERSCIENIA = 94.2; // 2π · 15

const KARTA = "rounded-xl border border-[#eaeaea] bg-white";
const ETYKIETA = "font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase";

export function MHabits({
  data,
  checks,
  initialTab,
  onToggle,
  onNewHabit,
  onNewSleep,
}: {
  data: HabitsPageData;
  // Odhaczenia ze store (z optymistycznymi zmianami)
  checks: Checks;
  initialTab: "sen" | null;
  onToggle: (habitId: string, date: IsoDate) => void;
  onNewHabit: () => void;
  // Wpis snu z datą pobudki (arkusz sam znajdzie wpis z tego dnia)
  onNewSleep: (date: IsoDate) => void;
}) {
  const { today, weekStart, habits } = data;
  const [zakladka, setZakladka] = useState<"nawyki" | "sen">(initialTab === "sen" ? "sen" : "nawyki");
  // Stuknięty dzień heatmapy i słupek snu
  const [dzien, setDzien] = useState<IsoDate | null>(null);
  const [zakres, setZakres] = useState<"14" | "30">("14");
  const [slupek, setSlupek] = useState<number | null>(null);

  const [, miesiac, numerDnia] = today.split("-").map(Number);
  const naglowek = `${DNI_PELNE[weekdayOf(today)]} · ${numerDnia} ${MIESIACE_DOP[miesiac - 1]}`;

  // ——— Nawyki ———
  // Dziś: zrobione / zaplanowane (X/tydz. liczy się dopiero po odhaczeniu)
  const dzis = dayStats(habits, checks, today, today);
  const kreska = dzis.planned === 0 ? 0 : (dzis.done / dzis.planned) * OBWOD_PIERSCIENIA;

  // Najdłuższa seria jak na webie (HabitTiles): tydzień serii X/tydz. = 7 dni, remis → alfabetycznie
  let rekord: { name: string; dni: number; label: string } | null = null;
  for (const habit of habits) {
    const seria = longestStreak(habit, checks, today, weekStart);
    const dni = seria.unit === "weeks" ? seria.value * 7 : seria.value;
    const lepsza =
      rekord === null || dni > rekord.dni || (dni === rekord.dni && habit.name.localeCompare(rekord.name, "pl") < 0);
    if (lepsza) rekord = { name: habit.name, dni, label: streakLabel(seria) };
  }

  // Heatmapa: 4 tygodnie, wiersz = tydzień
  const tygodnie = heatmapWeeks(habits, checks, 4, today, weekStart);
  const naglowkiDni = weekStart === "mon" ? SKROTY_DNI : [SKROTY_DNI[6], ...SKROTY_DNI.slice(0, 6)];
  let podpisDnia = "stuknij dzień";
  if (dzien) {
    const komorka = dayStats(habits, checks, dzien, today);
    podpisDnia = `${formatDatePl(dzien)} · ${
      komorka.planned === 0 ? "brak zaplanowanych" : `${komorka.done} z ${komorka.planned} nawyków`
    }`;
  }

  // ——— Sen ———
  // Ostatnia noc = wpis z najpóźniejszą datą (nie z przyszłości), jak SleepCard
  let ostatnia: SleepLog | null = null;
  for (const log of data.sleepLogs) {
    if (log.date <= today && (ostatnia === null || log.date > ostatnia.date)) ostatnia = log;
  }
  const minutyOstatniej = ostatnia ? sleepMinutes(ostatnia.sleptAt, ostatnia.wokeAt) : null;
  let opisOstatniej = "brak wpisów";
  if (ostatnia) {
    const [hs, ms] = ostatnia.sleptAt.split(":").map(Number);
    const [hw, mw] = ostatnia.wokeAt.split(":").map(Number);
    opisOstatniej = `${formatClockTime(hs, ms, data.clock)} → ${formatClockTime(hw, mw, data.clock)}`;
    if (ostatnia.feeling !== null) opisOstatniej += ` · ${SAMOPOCZUCIE[ostatnia.feeling - 1]}`;
  }

  const cel = data.sleepGoalMin;
  const statystyki = sleepStats(data.sleepLogs, today, zakres === "14" ? 14 : 30, cel);
  // Skala jak na webie: cel na 8/9 wysokości, chyba że któraś noc była dłuższa
  let skala = (cel * 9) / 8;
  for (const b of statystyki.bars) if (b.minutes !== null && b.minutes > skala) skala = b.minutes;
  const liniaCelu = Math.round((cel / skala) * WYSOKOSC_WYKRESU);
  // '2026-11-17' → '17.11'
  const krotko = (d: IsoDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  const opisSlupka = (k: number) => {
    const b = statystyki.bars[k];
    return `${krotko(b.date)} · ${b.minutes === null ? "brak wpisu" : `${formatDuration(b.minutes)} h`}`;
  };

  return (
    <div className="flex flex-col">
      <header className="flex min-h-[60px] items-center gap-1 pt-2 pr-2 pb-1 pl-4">
        <div className="min-w-0 flex-1">
          <div className={ETYKIETA}>{naglowek}</div>
          <h1 className="m-0 mt-0.5 text-[28px] font-semibold tracking-[-0.02em]">Nawyki i sen</h1>
        </div>
        <button
          type="button"
          aria-label="Nowy nawyk"
          onClick={onNewHabit}
          className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent p-0 text-[#171717] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#171717]/20"
        >
          <Plus size={22} aria-hidden="true" />
        </button>
      </header>

      <div className="mx-4 mb-2">
        <Segment
          ariaLabel="Widok"
          value={zakladka}
          onChange={setZakladka}
          options={[
            { value: "nawyki", label: "Nawyki" },
            { value: "sen", label: "Sen" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-1 pb-6">
        {zakladka === "nawyki" && habits.length === 0 && (
          // Stan pusty jak na webie
          <div className={cn(KARTA, "flex flex-col items-center gap-3 px-4 py-12 text-center")}>
            <p className="m-0 text-sm text-[#666666]">Nie masz jeszcze nawyków.</p>
            <Button variant="primary" onClick={onNewHabit}>
              Dodaj pierwszy nawyk
            </Button>
          </div>
        )}

        {zakladka === "nawyki" && habits.length > 0 && (
          <>
            {/* Pierścień dnia */}
            <div className={cn(KARTA, "flex items-center gap-3.5 p-3.5")}>
              <svg width="56" height="56" viewBox="0 0 36 36" role="img" aria-label={`${dzis.done} z ${dzis.planned} nawyków`}>
                <circle cx="18" cy="18" r="15" fill="none" stroke="#eeeeee" strokeWidth="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#15803d"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${kreska.toFixed(1)} ${OBWOD_PIERSCIENIA}`}
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold">{`${dzis.done} z ${dzis.planned} zrobione dziś`}</div>
                {rekord && (
                  <div className="text-[13px] text-[#666666]">{`Najdłuższa seria: ${rekord.name} · ${rekord.label}`}</div>
                )}
              </div>
            </div>

            {/* Lista nawyków */}
            <div className={KARTA}>
              {habits.map((habit) => {
                // Opis harmonogramu: wersja na dziś, a gdy nawyk rusza później — pierwsza; dni z wielkiej litery
                const wersja = scheduleOn(habit, today) ?? habit.schedules[0];
                const harmonogram = wersja
                  ? describeSchedule(wersja)
                      .split(", ")
                      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                      .join(", ")
                  : "";
                const seria = streakLabel(currentStreak(habit, checks, today, weekStart));
                const odhaczone = checks.get(habit.id)?.has(today) ?? false;
                // Odznaczyć wolno zawsze (także osierocone odhaczenie), odhaczyć tylko gdy dziś się da
                const aktywny = canCheck(habit, today, today) || odhaczone;
                return (
                  <div
                    key={habit.id}
                    className="flex min-h-16 items-center gap-3 border-b border-[#f0f0f0] px-3.5 last:border-b-0"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={odhaczone}
                      aria-label={habit.name}
                      disabled={!aktywny}
                      onClick={() => onToggle(habit.id, today)}
                      // Kwadrat 28 px, pole stuknięcia 44 px (pseudo-element)
                      className={cn(
                        "relative inline-flex size-7 flex-none cursor-pointer items-center justify-center rounded-lg border-[1.5px] p-0 text-white outline-none after:absolute after:-inset-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-[#171717]/20 disabled:cursor-default disabled:opacity-40",
                        odhaczone ? "border-[#15803d] bg-[#15803d]" : "border-[#cfcfcf] bg-white",
                      )}
                    >
                      {odhaczone && <CheckIcon aria-hidden="true" strokeWidth={3} className="size-[18px]" />}
                    </button>
                    <Link
                      href={`/nawyki/${habit.id}`}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-[#171717] no-underline"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{habit.name}</span>
                        <span className="font-mono text-xs text-[#6b6b6b]">{`${harmonogram} · seria ${seria}`}</span>
                      </span>
                      <ChevronRight size={16} aria-hidden="true" className="flex-none text-[#a3a3a3]" />
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Heatmapa 4 tygodni */}
            <section className={cn(KARTA, "p-3.5")}>
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-2">
                <h2 className="m-0 text-[17px] font-semibold">Ostatnie 4 tygodnie</h2>
                <span className="font-mono text-[11px] text-[#6b6b6b]">{podpisDnia}</span>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-[5px] text-center font-mono text-[10px] text-[#8a8a8a]">
                {naglowkiDni.map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-[5px]">
                {tygodnie.flat().map((komorka) => {
                  const przyszlosc = komorka.date > today;
                  // Dzień bez planu: jaśniejsze tło i przerywana ramka, żeby nie mylił się z 0%
                  const bezPlanu = !przyszlosc && komorka.percent === null;
                  // Kolor z % dnia: 0 → najjaśniejszy, 100% → najciemniejszy
                  let tlo = ODCIENIE[0];
                  if (komorka.percent !== null && komorka.percent > 0) {
                    tlo =
                      komorka.percent <= 25
                        ? ODCIENIE[1]
                        : komorka.percent <= 50
                          ? ODCIENIE[2]
                          : komorka.percent <= 75
                            ? ODCIENIE[3]
                            : komorka.percent < 100
                              ? ODCIENIE[4]
                              : ODCIENIE[5];
                  }
                  const opis = `${formatDatePl(komorka.date)} · ${
                    komorka.planned === 0 ? "brak zaplanowanych" : `${komorka.done} z ${komorka.planned} nawyków`
                  }`;
                  return (
                    <button
                      key={komorka.date}
                      type="button"
                      data-heat-day={komorka.date}
                      // Przyszłość bez szczegółów (jak dymek na webie)
                      disabled={przyszlosc}
                      aria-label={przyszlosc ? formatDatePl(komorka.date) : opis}
                      aria-pressed={dzien === komorka.date}
                      onClick={() => setDzien(komorka.date)}
                      // Pseudo-element poszerza pole stuknięcia do ~47 px (mieści się w odstępie 5 px)
                      className={cn(
                        "relative box-border aspect-square cursor-pointer rounded-md p-0 outline-none after:absolute after:-inset-0.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-[#171717] disabled:cursor-default",
                        przyszlosc
                          ? "border border-dashed border-[#e0e0e0]"
                          : bezPlanu
                            ? "border border-dashed border-[#d4d4d4]"
                            : "border-0",
                        dzien === komorka.date && "border-2 border-solid border-[#171717]",
                      )}
                      style={{ background: przyszlosc ? "#ffffff" : bezPlanu ? "#fafafa" : tlo }}
                    />
                  );
                })}
              </div>
              <div className="mt-2.5 flex items-center justify-end gap-1 text-[11px] text-[#6b6b6b]">
                <span>mniej</span>
                {[0, 1, 2, 3, 5].map((n) => (
                  <span key={n} aria-hidden="true" className="size-3 rounded-[3px]" style={{ background: ODCIENIE[n] }} />
                ))}
                <span>więcej</span>
              </div>
            </section>
          </>
        )}

        {zakladka === "sen" && (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#eaeaea] bg-[#eaeaea]">
              {ostatnia ? (
                // Stuknięcie otwiera wpis ostatniej nocy do edycji
                <button
                  type="button"
                  onClick={() => onNewSleep(ostatnia.date)}
                  className="block cursor-pointer border-0 bg-white px-3.5 py-3 text-left text-[#171717] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#171717]/20"
                >
                  <div className={ETYKIETA}>Ostatnia noc</div>
                  <div className="mt-1 font-mono text-[22px] font-medium">
                    {minutyOstatniej === null ? "—" : formatDuration(minutyOstatniej)}
                    <span className="text-sm text-[#6b6b6b]"> h</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#6b6b6b]">{opisOstatniej}</div>
                </button>
              ) : (
                <div className="bg-white px-3.5 py-3">
                  <div className={ETYKIETA}>Ostatnia noc</div>
                  <div className="mt-1 font-mono text-[22px] font-medium">—</div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#6b6b6b]">{opisOstatniej}</div>
                </div>
              )}
              <div className="bg-white px-3.5 py-3">
                <div className={ETYKIETA}>{`Średnio ${zakres} dni`}</div>
                <div className="mt-1 font-mono text-[22px] font-medium">
                  {statystyki.avg === null ? (
                    "—"
                  ) : (
                    <>
                      {formatDuration(statystyki.avg)}
                      <span className="text-sm text-[#6b6b6b]"> h</span>
                    </>
                  )}
                </div>
                {cel > 0 && (
                  <div className="mt-0.5 font-mono text-[11px] text-[#6b6b6b]">{`cel ${formatDuration(cel)}`}</div>
                )}
              </div>
            </div>

            <section className={cn(KARTA, "p-3.5")}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="m-0 text-[17px] font-semibold">Sen</h2>
                <div className="w-[140px]">
                  <Segment
                    ariaLabel="Zakres snu"
                    value={zakres}
                    onChange={(v) => {
                      setZakres(v);
                      setSlupek(null);
                    }}
                    options={[
                      { value: "14", label: "14 dni" },
                      { value: "30", label: "30 dni" },
                    ]}
                  />
                </div>
              </div>
              <div className="mb-1.5 min-h-[18px] font-mono text-xs text-[#404040]">
                {slupek === null ? "Stuknij słupek, żeby zobaczyć szczegóły" : opisSlupka(slupek)}
              </div>
              <div
                className={cn(
                  "relative flex items-end border-b border-[#eaeaea]",
                  zakres === "14" ? "gap-1.5" : "gap-[3px]",
                )}
                style={{ height: WYSOKOSC_WYKRESU }}
              >
                {cel > 0 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-[#bbe5cc]"
                    style={{ bottom: liniaCelu }}
                  />
                )}
                {statystyki.bars.map((b, k) => {
                  const wysokosc = b.minutes === null ? 0 : Math.round((b.minutes / skala) * WYSOKOSC_WYKRESU);
                  // Kolor jak w makiecie: cel → zielony, do 90% celu → jasnozielony, mniej → pomarańczowy
                  let kolor = "#e5a582";
                  if (b.minutes !== null && b.minutes >= cel) kolor = "#15803d";
                  else if (b.minutes !== null && b.minutes >= cel * 0.9) kolor = "#8fd1a8";
                  if (slupek === k) kolor = "#171717";
                  return (
                    // Przycisk na całą wysokość wykresu, żeby dało się trafić także w niski słupek
                    <button
                      key={b.date}
                      type="button"
                      data-sleep-bar
                      aria-label={opisSlupka(k)}
                      aria-pressed={slupek === k}
                      onClick={() => setSlupek(k)}
                      className="flex h-full min-w-0 flex-1 cursor-pointer items-end border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                    >
                      <span
                        className="block w-full rounded-t-[4px]"
                        style={{
                          height: b.minutes === null ? 3 : wysokosc,
                          background: b.minutes === null ? "#f0f0f0" : kolor,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[#8a8a8a]">
                <span>{krotko(statystyki.bars[0].date)}</span>
                <span>dziś</span>
              </div>
            </section>

            <Button variant="primary" className="h-12 w-full rounded-[10px] text-[15px]" onClick={() => onNewSleep(today)}>
              <Moon size={18} aria-hidden="true" />
              Dodaj wpis snu
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
