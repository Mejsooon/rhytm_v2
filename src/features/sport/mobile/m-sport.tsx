"use client";

// Ekran „Sport” na telefonie wg MSport.dc.html: nagłówek z numerem tygodnia i „+”, segment Tydzień / Miesiąc,
// karta „Bieganie” (km / cel z paskiem tylko przy włączonym celu km), wykres km ze stuknięciem słupka,
// przyciski „Bieg” i „Trening” oraz lista „Ostatnie”. „Trening” otwiera te same opcje co „+ Trening siłowy”
// na webie (Ruling): „Pusty trening”, szablony („Z szablonu”) i „Szablony treningów…”.
// *[Claude]* „Miesiąc” = 4 ostatnie tygodnie (ostatni = bieżący, jak w makiecie „t. 43–46”), cel = 4 × cel tygodnia.
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import { ActionPopover, Segment } from "@/components/controls";
import { DNI_SKROT } from "@/features/calendar/mobile/pl";
import {
  addDays,
  isoWeekNumber,
  weekdayOf,
} from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import type { RunRequest } from "../item-popover";
import type { SportMonthData } from "../load-sport";
import {
  formatDuration,
  formatKm,
  formatPace,
  plPlural,
  weekStats,
} from "../model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const WYSOKOSC_WYKRESU = 116; // px, najwyższy słupek
const KARTA = "rounded-xl border border-[#eaeaea] bg-white";
const ETYKIETA =
  "font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase";
const PRZYCISK =
  "box-border flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20";
// Opcja dymku „Trening” — wiersz 44 px
const OPCJA =
  "flex min-h-11 w-full cursor-pointer items-center rounded-lg border-0 bg-transparent px-3 text-left text-[15px] text-[#171717] no-underline outline-none hover:bg-[#f5f5f5] hover:text-[#171717] focus-visible:bg-[#f5f5f5]";
const IKONA_WIERSZA =
  "flex size-10 flex-none items-center justify-center rounded-[10px]";

export function MSport({
  data,
  onNewRun,
  onNewGym,
  onOpenRun,
}: {
  data: SportMonthData;
  onNewRun: () => void;
  // Trening siłowy: null = pusty, inaczej id szablonu (wystąpienie z dziś)
  onNewGym: (templateId: string | null) => void;
  onOpenRun: (req: RunRequest) => void;
}) {
  const { today, profile, items } = data;
  const [zakres, setZakres] = useState<"w" | "m">("w");
  const [slupek, setSlupek] = useState<number | null>(null);
  const [menuTreningu, setMenuTreningu] = useState(false);

  // Bieżący tydzień od profiles.week_start; numer ISO ze środka tygodnia (jak WeekTiles)
  const dzien = weekdayOf(today);
  const biezacy = addDays(
    today,
    -(profile.weekStart === "mon" ? dzien - 1 : dzien % 7),
  );
  const koniecTygodnia = addDays(biezacy, 6);
  const dd = (d: string) => String(Number(d.slice(8, 10)));
  const mm = (d: string) => d.slice(5, 7);
  const zakresDat =
    mm(biezacy) === mm(koniecTygodnia)
      ? `${dd(biezacy)}–${dd(koniecTygodnia)}.${mm(koniecTygodnia)}`
      : `${dd(biezacy)}.${mm(biezacy)}–${dd(koniecTygodnia)}.${mm(koniecTygodnia)}`;
  const naglowek = `Tydzień ${isoWeekNumber(addDays(biezacy, 3))} · ${zakresDat}`;

  // Zakres karty: tydzień albo 4 ostatnie tygodnie
  const od = zakres === "w" ? biezacy : addDays(biezacy, -21);
  const wykonane = items.filter(
    (i) => !i.planned && i.date >= od && i.date <= koniecTygodnia,
  );
  let km = 0;
  let sekundy = 0;
  let biegi = 0;
  let silownia = 0;
  for (const i of wykonane) {
    if (i.kind === "gym") {
      silownia += 1;
      continue;
    }
    biegi += 1;
    // Tempo tylko z biegów z dystansem i czasem naraz (jak weekStats)
    if (i.distanceKm !== null && i.durationS !== null) {
      km += i.distanceKm;
      sekundy += i.durationS;
    }
  }
  const tempo = km > 0 ? formatPace(sekundy / km) : "—";
  const cel = zakres === "w" ? profile.weeklyKmGoal : profile.weeklyKmGoal * 4;

  // Słupki: dni tygodnia albo 4 tygodnie
  const slupki =
    zakres === "w"
      ? Array.from({ length: 7 }, (_, i) => {
          const data = addDays(biezacy, i);
          let suma = 0;
          for (const w of wykonane) {
            if (w.kind === "run" && w.date === data && w.durationS !== null)
              suma += w.distanceKm ?? 0;
          }
          return { etykieta: DNI_SKROT[weekdayOf(data)], km: suma };
        })
      : Array.from({ length: 4 }, (_, i) => {
          const poczatek = addDays(biezacy, (i - 3) * 7);
          return {
            etykieta: `t. ${isoWeekNumber(addDays(poczatek, 3))}`,
            km: weekStats(items, poczatek).km,
          };
        });
  const najwiecej = Math.max(0, ...slupki.map((s) => s.km)) || 1;

  const ostatnie = data.recent.slice(0, 5);

  return (
    <div className="flex flex-col">
      <header className="flex min-h-[60px] items-center gap-1 pt-2 pr-2 pb-1 pl-4">
        <div className="min-w-0 flex-1">
          <div className={ETYKIETA}>{naglowek}</div>
          <h1 className="m-0 mt-0.5 text-[28px] font-semibold tracking-[-0.02em]">
            Sport
          </h1>
        </div>
        <button
          type="button"
          aria-label="Nowa aktywność"
          onClick={onNewRun}
          className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent p-0 text-[#171717] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#171717]/20"
        >
          <Plus size={22} aria-hidden="true" />
        </button>
      </header>

      <div className="mx-4 mb-2">
        <Segment
          ariaLabel="Zakres"
          value={zakres}
          onChange={(v) => {
            setZakres(v);
            setSlupek(null);
          }}
          options={[
            { value: "w", label: "Tydzień" },
            { value: "m", label: "Miesiąc" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-1 pb-6">
        <section
          aria-labelledby="m-sport-bieganie"
          className={cn(KARTA, "p-4")}
        >
          <div id="m-sport-bieganie" className={ETYKIETA}>
            Bieganie
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              data-testid="km"
              className="font-mono text-[34px] font-medium"
            >
              {formatKm(km)}
            </span>
            <span className="text-[13px] text-[#666666]">
              {profile.kmGoalOn ? `/ ${cel} km` : "km"}
            </span>
          </div>
          {profile.kmGoalOn && (
            <div className="mt-2.5 h-2 overflow-hidden rounded-[4px] bg-[#f0f0f0]">
              <div
                data-testid="pasek-km"
                className="h-full rounded-[4px] bg-[#c2410c]"
                style={{
                  width: `${Math.min(100, Math.round((km / cel) * 100))}%`,
                }}
              />
            </div>
          )}
          <div className="mt-3.5 grid grid-cols-3">
            <div>
              <div className={ETYKIETA}>Biegi</div>
              <div data-testid="biegi" className="mt-0.5 font-mono text-[17px]">
                {biegi}
              </div>
            </div>
            <div>
              <div className={ETYKIETA}>Śr. tempo</div>
              <div data-testid="tempo" className="mt-0.5 font-mono text-[17px]">
                {tempo}
              </div>
            </div>
            <div>
              <div className={ETYKIETA}>Siłownia</div>
              <div
                data-testid="silownia"
                className="mt-0.5 font-mono text-[17px]"
              >{`${silownia}×`}</div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="m-sport-kilometry"
          className={cn(KARTA, "p-3.5")}
        >
          <div className="flex items-baseline justify-between">
            <h2
              id="m-sport-kilometry"
              className="m-0 text-[17px] font-semibold"
            >
              Kilometry
            </h2>
            <span className="font-mono text-xs text-[#404040]">
              {slupek === null
                ? "stuknij słupek"
                : `${slupki[slupek].etykieta} · ${formatKm(slupki[slupek].km)} km`}
            </span>
          </div>
          <div
            className={cn(
              // Odstęp między słupkami jest w przyciskach (padding), żeby pole stuknięcia miało ≥ 44 px
              "-mx-[5px] mt-3 flex items-end border-b border-[#eaeaea]",
            )}
            style={{ height: 120 }}
          >
            {slupki.map((s, k) => (
              // Przycisk na całą wysokość wykresu, żeby dało się trafić także w niski słupek
              <button
                key={s.etykieta}
                type="button"
                aria-label={`${s.etykieta}: ${formatKm(s.km)} km`}
                aria-pressed={slupek === k}
                onClick={() => setSlupek(k)}
                className={cn(
                  "flex h-full min-w-0 flex-1 cursor-pointer items-end border-0 bg-transparent py-0 outline-none focus-visible:ring-2 focus-visible:ring-[#171717]",
                  zakres === "w" ? "px-[5px]" : "px-3",
                )}
              >
                <span
                  className="block w-full rounded-t-md"
                  style={{
                    height: Math.max(
                      4,
                      Math.round((s.km / najwiecej) * WYSOKOSC_WYKRESU),
                    ),
                    background:
                      slupek === k ? "#171717" : s.km ? "#c2410c" : "#eeeeee",
                  }}
                />
              </button>
            ))}
          </div>
          <div className="-mx-[5px] mt-1.5 flex font-mono text-[10px] text-[#8a8a8a]">
            {slupki.map((s) => (
              <span key={s.etykieta} className="flex-1 text-center">
                {s.etykieta}
              </span>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onNewRun}
            className={cn(PRZYCISK, "border-[#171717] bg-[#171717] text-white")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12h4l3-8 4 16 3-8h4" />
            </svg>
            Bieg
          </button>
          <ActionPopover
            open={menuTreningu}
            onOpenChange={setMenuTreningu}
            align="end"
            side="top"
            width={260}
            ariaLabel="Nowy trening"
            trigger={
              <button
                type="button"
                className={cn(
                  PRZYCISK,
                  "border-[#e0e0e0] bg-white text-[#171717] hover:bg-[#fafafa]",
                )}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
                </svg>
                Trening
              </button>
            }
          >
            <div className="flex flex-col gap-px">
              <button
                type="button"
                className={OPCJA}
                onClick={() => {
                  setMenuTreningu(false);
                  onNewGym(null);
                }}
              >
                Pusty trening
              </button>
              {data.templates.length > 0 && (
                <>
                  <div className="mt-1 border-t border-[#eaeaea] px-3 pt-2 pb-1 font-mono text-[10px] tracking-[0.06em] text-[#6b6b6b] uppercase">
                    Z szablonu
                  </div>
                  {data.templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={OPCJA}
                      onClick={() => {
                        setMenuTreningu(false);
                        onNewGym(t.id);
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </>
              )}
              <div className="my-1 border-t border-[#eaeaea]" />
              <Link
                href="/sport/szablony"
                className={OPCJA}
                onClick={() => setMenuTreningu(false)}
              >
                Szablony treningów…
              </Link>
            </div>
          </ActionPopover>
        </div>

        <section aria-labelledby="m-sport-ostatnie">
          <h2
            id="m-sport-ostatnie"
            className="m-0 mb-2 text-[17px] font-semibold"
          >
            Ostatnie
          </h2>
          <div className={KARTA}>
            {ostatnie.length === 0 && (
              <p className="m-0 px-3.5 py-4 text-sm text-[#666666]">
                Brak wykonanych treningów.
              </p>
            )}
            {ostatnie.map((item) => {
              const wiersz =
                "flex min-h-16 w-full items-center gap-3 border-0 border-b border-solid border-[#f0f0f0] bg-transparent px-3.5 text-left text-[15px] text-[#171717] no-underline outline-none last:border-b-0 hover:bg-[#fafafa] focus-visible:bg-[#fafafa]";
              const kiedy = `${DNI[weekdayOf(item.date)]} ${item.date.slice(8, 10)}.${item.date.slice(5, 7)}`;
              if (item.kind === "run") {
                const kmBiegu = item.distanceKm ?? 0;
                const opis = [kiedy];
                if (item.durationS !== null)
                  opis.push(formatDuration(item.durationS));
                if (kmBiegu > 0 && item.durationS !== null)
                  opis.push(`${formatPace(item.durationS / kmBiegu)}/km`);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      item.sessionId && onOpenRun({ sessionId: item.sessionId })
                    }
                    className={cn(wiersz, "cursor-pointer")}
                  >
                    <span
                      className={cn(
                        IKONA_WIERSZA,
                        "bg-[#fff4ed] text-[#c2410c]",
                      )}
                    >
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 12h4l3-8 4 16 3-8h4" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{`${item.title} · ${formatKm(kmBiegu)} km`}</span>
                      <span className="font-mono text-xs text-[#6b6b6b]">
                        {opis.join(" · ")}
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                      className="flex-none text-[#a3a3a3]"
                    />
                  </button>
                );
              }
              const serie =
                data.setsHistory.find((s) => s.sessionId === item.sessionId)
                  ?.sets ?? [];
              const cwiczen = new Set(serie.map((s) => s.exercise_id)).size;
              return (
                <Link
                  key={item.key}
                  href={`/sport/trening/${item.sessionId}`}
                  className={wiersz}
                >
                  <span
                    className={cn(IKONA_WIERSZA, "bg-[#f5f3ff] text-[#7c3aed]")}
                  >
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{`Siłownia — ${item.title}`}</span>
                    <span className="font-mono text-xs text-[#6b6b6b]">
                      {`${kiedy} · ${plPlural(cwiczen, "ćwiczenie", "ćwiczenia", "ćwiczeń")} · ${item.durationMin} min`}
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="flex-none text-[#a3a3a3]"
                  />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
