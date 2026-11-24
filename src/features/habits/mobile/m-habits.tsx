"use client";

// Ekran „Nawyki i sen” na telefonie wg CMHabits.dc.html: nagłówek z „+”, segment Nawyki / Sen.
// Nawyki: pierścień dnia, lista z checkboxem (odhacza dziś przez wspólny store), heatmapa z zakresem.
// Sen: ostatnia noc i średnia, wykres 14/30 dni ze stuknięciem słupka, „Dodaj wpis snu”.
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Flame, Moon, Plus } from "lucide-react";

import {
  Button,
  Card,
  CardTitle,
  Checkbox,
  Segment,
  StatusBadge,
} from "@/components/controls";
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
// Kolory heatmapy i słupków snu to dane z renderVals makiety CMHabits (nie tokeny UI):
// brak → jasnoszary, do 40% → jasny, do 80% → średni, powyżej → pełny
const ODCIENIE = ["rgba(0,0,0,.05)", "#bbe5cc", "#86c99f", "#15803d"];
const SLUPEK_CEL = "#15803d";
const SLUPEK_BLISKO = "#bbe5cc";
const SLUPEK_MALO = "rgba(0,0,0,.12)";
const OBRYS_WYBRANEGO = "0 0 0 2px #fff, 0 0 0 4px #262626";
const OBRYS_SLUPKA = "0 0 0 2px #262626";
// Zakresy heatmapy jak przełącznik z makiety: wartość → tygodnie, etykieta i tytuł karty
const ZAKRESY_HEATMAPY = [
  { value: "30", weeks: 4, label: "30 dni", title: "Ostatnie 30 dni" },
  { value: "90", weeks: 13, label: "3 mies.", title: "Ostatnie 3 miesiące" },
  { value: "180", weeks: 26, label: "6 mies.", title: "Ostatnie 6 miesięcy" },
  { value: "365", weeks: 52, label: "Rok", title: "Ostatni rok" },
] as const;
type ZakresHeatmapy = (typeof ZAKRESY_HEATMAPY)[number]["value"];
const WYSOKOSC_WYKRESU = 140; // px
const OBWOD_PIERSCIENIA = 94.2; // 2π · 15

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
  const [zakladka, setZakladka] = useState<"nawyki" | "sen">(
    initialTab === "sen" ? "sen" : "nawyki",
  );
  // Stuknięty dzień heatmapy i słupek snu
  const [dzien, setDzien] = useState<IsoDate | null>(null);
  const [zakres, setZakres] = useState<"14" | "30">("14");
  const [zakresHeatmapy, setZakresHeatmapy] = useState<ZakresHeatmapy>("30");
  const [slupek, setSlupek] = useState<number | null>(null);

  const [, miesiac, numerDnia] = today.split("-").map(Number);
  const naglowek = `${DNI_PELNE[weekdayOf(today)]} · ${numerDnia} ${MIESIACE_DOP[miesiac - 1]}`;

  // ——— Nawyki ———
  // Dziś: zrobione / zaplanowane (X/tydz. liczy się dopiero po odhaczeniu)
  const dzis = dayStats(habits, checks, today, today);
  const kreska =
    dzis.planned === 0 ? 0 : (dzis.done / dzis.planned) * OBWOD_PIERSCIENIA;

  // Najdłuższa seria jak na webie (HabitTiles): tydzień serii X/tydz. = 7 dni, remis → alfabetycznie
  let rekord: { name: string; dni: number; label: string } | null = null;
  for (const habit of habits) {
    const seria = longestStreak(habit, checks, today, weekStart);
    const dni = seria.unit === "weeks" ? seria.value * 7 : seria.value;
    const lepsza =
      rekord === null ||
      dni > rekord.dni ||
      (dni === rekord.dni && habit.name.localeCompare(rekord.name, "pl") < 0);
    if (lepsza) rekord = { name: habit.name, dni, label: streakLabel(seria) };
  }

  // Heatmapa: wiersz = tydzień, liczba tygodni z wybranego zakresu
  const zakresH = ZAKRESY_HEATMAPY.find((z) => z.value === zakresHeatmapy)!;
  const tygodnie = heatmapWeeks(
    habits,
    checks,
    zakresH.weeks,
    today,
    weekStart,
  );
  const naglowkiDni =
    weekStart === "mon"
      ? SKROTY_DNI
      : [SKROTY_DNI[6], ...SKROTY_DNI.slice(0, 6)];
  let podpisDnia = "stuknij dzień";
  if (dzien) {
    const komorka = dayStats(habits, checks, dzien, today);
    podpisDnia = `${formatDatePl(dzien)} · ${
      komorka.planned === 0
        ? "brak zaplanowanych"
        : `${komorka.done} z ${komorka.planned} nawyków`
    }`;
  }

  // ——— Sen ———
  // Ostatnia noc = wpis z najpóźniejszą datą (nie z przyszłości), jak SleepCard
  let ostatnia: SleepLog | null = null;
  for (const log of data.sleepLogs) {
    if (log.date <= today && (ostatnia === null || log.date > ostatnia.date))
      ostatnia = log;
  }
  const minutyOstatniej = ostatnia
    ? sleepMinutes(ostatnia.sleptAt, ostatnia.wokeAt)
    : null;
  let opisOstatniej = "brak wpisów";
  if (ostatnia) {
    const [hs, ms] = ostatnia.sleptAt.split(":").map(Number);
    const [hw, mw] = ostatnia.wokeAt.split(":").map(Number);
    opisOstatniej = `${formatClockTime(hs, ms, data.clock)} → ${formatClockTime(hw, mw, data.clock)}`;
    if (ostatnia.feeling !== null)
      opisOstatniej += ` · ${SAMOPOCZUCIE[ostatnia.feeling - 1]}`;
  }

  const cel = data.sleepGoalMin;
  const statystyki = sleepStats(
    data.sleepLogs,
    today,
    zakres === "14" ? 14 : 30,
    cel,
  );
  // Skala jak na webie: cel na 8/9 wysokości, chyba że któraś noc była dłuższa
  let skala = (cel * 9) / 8;
  for (const b of statystyki.bars)
    if (b.minutes !== null && b.minutes > skala) skala = b.minutes;
  const liniaCelu = Math.round((cel / skala) * WYSOKOSC_WYKRESU);
  // '2026-11-17' → '17.11'
  const krotko = (d: IsoDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  const opisSlupka = (k: number) => {
    const b = statystyki.bars[k];
    return `${krotko(b.date)} · ${b.minutes === null ? "brak wpisu" : `${formatDuration(b.minutes)} h`}`;
  };

  return (
    <div className="flex flex-col">
      <header className="m-head py-1">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">
            {naglowek}
          </div>
          <h1 className="m-title">Nawyki i sen</h1>
        </div>
        <Button
          variant="ghost"
          icon
          aria-label="Nowy nawyk"
          onClick={onNewHabit}
        >
          <Plus size={20} aria-hidden="true" />
        </Button>
      </header>

      <div className="mx-4 mt-3 mb-2">
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
          <Card className="items-center gap-3 px-4 py-12 text-center">
            <p className="m-0 text-sm text-muted-foreground">
              Nie masz jeszcze nawyków.
            </p>
            <Button variant="primary" onClick={onNewHabit}>
              Dodaj pierwszy nawyk
            </Button>
          </Card>
        )}

        {zakladka === "nawyki" && habits.length > 0 && (
          <>
            {/* Pierścień dnia (jest w makiecie) */}
            <Card className="flex-row items-center gap-3.5 p-3.5">
              <svg
                width="56"
                height="56"
                viewBox="0 0 36 36"
                role="img"
                aria-label={`${dzis.done} z ${dzis.planned} nawyków`}
              >
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="rgba(0,0,0,.06)"
                  strokeWidth="4"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className="stroke-success"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${kreska.toFixed(1)} ${OBWOD_PIERSCIENIA}`}
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold tabular-nums">{`${dzis.done} z ${dzis.planned} zrobione dziś`}</div>
                {rekord && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{`Najdłuższa seria: ${rekord.name} · ${rekord.label}`}</div>
                )}
              </div>
            </Card>

            {/* Lista nawyków */}
            <Card>
              {habits.map((habit) => {
                // Opis harmonogramu: wersja na dziś, a gdy nawyk rusza później — pierwsza; dni z wielkiej litery
                const wersja = scheduleOn(habit, today) ?? habit.schedules[0];
                const harmonogram = wersja
                  ? describeSchedule(wersja)
                      .split(", ")
                      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                      .join(", ")
                  : "";
                const seria = streakLabel(
                  currentStreak(habit, checks, today, weekStart),
                );
                const odhaczone = checks.get(habit.id)?.has(today) ?? false;
                // Odznaczyć wolno zawsze (także osierocone odhaczenie), odhaczyć tylko gdy dziś się da
                const aktywny = canCheck(habit, today, today) || odhaczone;
                return (
                  <div key={habit.id} className="m-row py-2">
                    <Checkbox
                      checked={odhaczone}
                      ariaLabel={habit.name}
                      disabled={!aktywny}
                      onChange={() => onToggle(habit.id, today)}
                    />
                    <Link
                      href={`/nawyki/${habit.id}`}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-foreground no-underline"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{habit.name}</span>
                        <span className="mt-1 flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {harmonogram}
                          </span>
                          <StatusBadge tone="gray" className="tabular-nums">
                            <Flame size={11} aria-hidden="true" />
                            {`seria ${seria}`}
                          </StatusBadge>
                        </span>
                      </span>
                      <ChevronRight
                        size={16}
                        aria-hidden="true"
                        className="flex-none text-faint-foreground"
                      />
                    </Link>
                  </div>
                );
              })}
            </Card>

            {/* Heatmapa z zakresem */}
            <Card className="p-3.5">
              <div className="mb-2.5 flex items-baseline justify-between gap-x-2">
                <CardTitle as="h2" className="text-[15px]">
                  {zakresH.title}
                </CardTitle>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {podpisDnia}
                </span>
              </div>
              <div className="mb-2.5">
                <Segment
                  ariaLabel="Zakres heatmapy"
                  value={zakresHeatmapy}
                  onChange={(v) => {
                    setZakresHeatmapy(v);
                    setDzien(null);
                  }}
                  options={ZAKRESY_HEATMAPY.map((z) => ({
                    value: z.value,
                    label: z.label,
                  }))}
                />
              </div>
              <div className="mb-1 grid grid-cols-7 gap-[5px] text-center text-xs font-medium text-muted-foreground">
                {naglowkiDni.map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-[5px]">
                {tygodnie.flat().map((komorka) => {
                  const przyszlosc = komorka.date > today;
                  // Dzień bez planu: jaśniejsze tło i przerywana ramka, żeby nie mylił się z 0%
                  const bezPlanu = !przyszlosc && komorka.percent === null;
                  // Kolor z % dnia (progi jak na webie): 0 → najjaśniejszy, powyżej 80% → pełny
                  let tlo = ODCIENIE[0];
                  if (komorka.percent !== null && komorka.percent > 0) {
                    tlo =
                      komorka.percent <= 40
                        ? ODCIENIE[1]
                        : komorka.percent <= 80
                          ? ODCIENIE[2]
                          : ODCIENIE[3];
                  }
                  const opis = `${formatDatePl(komorka.date)} · ${
                    komorka.planned === 0
                      ? "brak zaplanowanych"
                      : `${komorka.done} z ${komorka.planned} nawyków`
                  }`;
                  return (
                    <button
                      key={komorka.date}
                      type="button"
                      data-heat-day={komorka.date}
                      // Przyszłość bez szczegółów (jak dymek na webie)
                      disabled={przyszlosc}
                      aria-label={
                        przyszlosc ? formatDatePl(komorka.date) : opis
                      }
                      aria-pressed={dzien === komorka.date}
                      onClick={() => setDzien(komorka.date)}
                      // Pseudo-element poszerza pole stuknięcia do ~47 px (mieści się w odstępie 5 px)
                      className={cn(
                        "relative box-border aspect-square cursor-pointer rounded-lg p-0 outline-none after:absolute after:-inset-0.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                        przyszlosc
                          ? "border border-dashed border-input bg-white"
                          : bezPlanu
                            ? "border border-dashed border-border-strong bg-panel"
                            : "border-0",
                      )}
                      style={{
                        background: przyszlosc || bezPlanu ? undefined : tlo,
                        boxShadow:
                          dzien === komorka.date ? OBRYS_WYBRANEGO : undefined,
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-2.5 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                <span>mniej</span>
                {ODCIENIE.map((kolor) => (
                  <span
                    key={kolor}
                    aria-hidden="true"
                    className="size-3 rounded-[3px]"
                    style={{ background: kolor }}
                  />
                ))}
                <span>więcej</span>
              </div>
            </Card>
          </>
        )}

        {zakladka === "sen" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                {ostatnia ? (
                  // Stuknięcie otwiera wpis ostatniej nocy do edycji
                  <button
                    type="button"
                    onClick={() => onNewSleep(ostatnia.date)}
                    className="block w-full cursor-pointer rounded-xl border-0 bg-transparent p-3.5 text-left text-foreground outline-none focus-visible:shadow-focus"
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      Ostatnia noc
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
                      {minutyOstatniej === null
                        ? "—"
                        : formatDuration(minutyOstatniej)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        h
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {opisOstatniej}
                    </div>
                  </button>
                ) : (
                  <div className="p-3.5">
                    <div className="text-xs font-medium text-muted-foreground">
                      Ostatnia noc
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">
                      —
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {opisOstatniej}
                    </div>
                  </div>
                )}
              </Card>
              <Card className="p-3.5">
                <div className="text-xs font-medium text-muted-foreground">{`Średnio ${zakres} dni`}</div>
                <div className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
                  {statystyki.avg === null ? (
                    "—"
                  ) : (
                    <>
                      {formatDuration(statystyki.avg)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        h
                      </span>
                    </>
                  )}
                </div>
                {cel > 0 && (
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{`cel ${formatDuration(cel)}`}</div>
                )}
              </Card>
            </div>

            <Card className="p-3.5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <CardTitle as="h2" className="text-[15px]">
                  Sen
                </CardTitle>
                <div className="w-[150px]">
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
              <div className="mb-1.5 min-h-[18px] text-xs tabular-nums">
                {slupek === null
                  ? "Stuknij słupek, żeby zobaczyć szczegóły"
                  : opisSlupka(slupek)}
              </div>
              <div
                className={cn(
                  "relative flex items-end border-b border-border",
                  zakres === "14" ? "gap-1.5" : "gap-[3px]",
                )}
                style={{ height: WYSOKOSC_WYKRESU }}
              >
                {cel > 0 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-success"
                    style={{ bottom: liniaCelu }}
                  />
                )}
                {statystyki.bars.map((b, k) => {
                  const wysokosc =
                    b.minutes === null
                      ? 0
                      : Math.round((b.minutes / skala) * WYSOKOSC_WYKRESU);
                  // Kolor jak w makiecie: cel → zielony, do 90% celu → jasnozielony, mniej → szary
                  let kolor = SLUPEK_MALO;
                  if (b.minutes !== null && b.minutes >= cel)
                    kolor = SLUPEK_CEL;
                  else if (b.minutes !== null && b.minutes >= cel * 0.9)
                    kolor = SLUPEK_BLISKO;
                  return (
                    // Przycisk na całą wysokość wykresu, żeby dało się trafić także w niski słupek
                    <button
                      key={b.date}
                      type="button"
                      data-sleep-bar
                      aria-label={opisSlupka(k)}
                      aria-pressed={slupek === k}
                      onClick={() => setSlupek(k)}
                      className="flex h-full min-w-0 flex-1 cursor-pointer items-end border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className="block w-full rounded-t-[4px]"
                        style={{
                          height: b.minutes === null ? 3 : wysokosc,
                          background:
                            b.minutes === null ? "rgba(0,0,0,.05)" : kolor,
                          boxShadow: slupek === k ? OBRYS_SLUPKA : undefined,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{krotko(statystyki.bars[0].date)}</span>
                <span>dziś</span>
              </div>
            </Card>

            <Button
              variant="primary"
              className="w-full"
              onClick={() => onNewSleep(today)}
            >
              <Moon size={18} aria-hidden="true" />
              Dodaj wpis snu
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
