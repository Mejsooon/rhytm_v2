"use client";

// Kafelki bieżącego tygodnia i wykres 12 ostatnich tygodni (Sport.dc.html, „STATYSTYKI”, lewa karta).
// Kafelek jest przełącznikiem wykresu; linia celu tylko dla km i treningów przy włączonym celu.
import { useState } from "react";

import { StatusBadge } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import {
  addDays,
  isoWeekNumber,
  weekdayOf,
} from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import type { SportProfile } from "./load-sport";
import { formatKm, formatPace, weekStats, type SportItem } from "./model";

type Miara = "km" | "pace" | "sessions" | "kcal";

const WYSOKOSC = 140; // px, najwyższy słupek

export function WeekTiles({
  items,
  today,
  profile,
}: {
  items: SportItem[];
  today: IsoDate;
  profile: SportProfile;
}) {
  const [miara, setMiara] = useState<Miara>("km");
  // Tydzień pod kursorem (albo z fokusem klawiatury): podświetlony słupek i dymek
  const [aktywny, setAktywny] = useState<number | null>(null);

  // 12 tygodni od profiles.week_start; ostatni = bieżący
  const dzien = weekdayOf(today);
  const biezacy = addDays(
    today,
    -(profile.weekStart === "mon" ? dzien - 1 : dzien % 7),
  );
  const tygodnie = Array.from({ length: 12 }, (_, i) => {
    const od = addDays(biezacy, (i - 11) * 7);
    // Numer ISO ze środka tygodnia (przy tygodniu od niedzieli niedziela należy do poprzedniego)
    return {
      numer: isoWeekNumber(addDays(od, 3)),
      od,
      ...weekStats(items, od),
    };
  });
  const teraz = tygodnie[11];

  const kafelki: {
    klucz: Miara;
    etykieta: string;
    wartosc: string;
    dopisek: string;
  }[] = [
    {
      klucz: "km",
      etykieta: "Km / tydz.",
      wartosc: formatKm(teraz.km),
      dopisek: profile.kmGoalOn ? `/ ${profile.weeklyKmGoal}` : "",
    },
    {
      klucz: "pace",
      etykieta: "Śr. tempo",
      wartosc: teraz.paceS !== null ? formatPace(teraz.paceS) : "—",
      dopisek: teraz.paceS !== null ? "/km" : "",
    },
    {
      klucz: "sessions",
      etykieta: "Treningi",
      wartosc: String(teraz.done),
      dopisek: profile.workoutsGoalOn
        ? `/ ${profile.weeklyWorkoutsGoal} plan`
        : "",
    },
    {
      klucz: "kcal",
      etykieta: "Kcal",
      wartosc: teraz.kcal.toLocaleString("pl-PL"),
      dopisek: "",
    },
  ];

  // Dane wykresu wybranej miary: wartości tygodni, cel (albo null) i opisy jak w makiecie
  let wartosci: number[];
  let cel: number | null = null;
  let tytul: string;
  let notka: string;
  let celTekst = "";
  let format: (v: number) => string;
  let jednostka: string;
  if (miara === "km") {
    wartosci = tygodnie.map((t) => t.km);
    tytul = "Kilometry tygodniowo";
    notka = profile.kmGoalOn
      ? `ostatnie 12 tyg. · cel ${profile.weeklyKmGoal} km`
      : "ostatnie 12 tyg.";
    if (profile.kmGoalOn) {
      cel = profile.weeklyKmGoal;
      celTekst = `cel ${profile.weeklyKmGoal} km`;
    }
    format = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
    jednostka = " km";
  } else if (miara === "pace") {
    wartosci = tygodnie.map((t) => t.paceS ?? 0);
    tytul = "Średnie tempo biegów";
    notka = "wyższy słupek = szybciej";
    format = (v) => formatPace(v);
    jednostka = " /km";
  } else if (miara === "sessions") {
    wartosci = tygodnie.map((t) => t.done);
    tytul = "Treningi tygodniowo";
    notka = "bieg + siłownia";
    if (profile.workoutsGoalOn) {
      cel = profile.weeklyWorkoutsGoal;
      celTekst = `plan ${profile.weeklyWorkoutsGoal}`;
    }
    format = (v) => String(v);
    jednostka = " tr.";
  } else {
    wartosci = tygodnie.map((t) => t.kcal);
    tytul = "Spalone kcal tygodniowo";
    notka = "biegi, wzór ACSM";
    format = (v) => v.toLocaleString("pl-PL");
    jednostka = " kcal";
  }

  // Skala: największa wartość albo cel z zapasem 20%; tempo odwrotnie (krótszy czas = wyższy słupek)
  const niezerowe = wartosci.filter((v) => v > 0);
  const maks = Math.max(1, cel ?? 0, ...wartosci) * 1.2;
  const najszybsze = niezerowe.length > 0 ? Math.min(...niezerowe) - 20 : 0;
  const najwolniejsze = niezerowe.length > 0 ? Math.max(...niezerowe) + 20 : 1;
  const wysokosc = (v: number) =>
    miara === "pace"
      ? Math.round(
          ((najwolniejsze - v) / (najwolniejsze - najszybsze)) * WYSOKOSC,
        )
      : Math.round((v / maks) * WYSOKOSC);
  const liniaCelu = cel !== null ? wysokosc(cel) : 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white bg-clip-padding shadow-card">
      <div className="grid grid-cols-4 border-b border-border">
        {kafelki.map((k, i) => {
          const wlaczony = miara === k.klucz;
          return (
            <button
              key={k.klucz}
              type="button"
              aria-pressed={wlaczony}
              onClick={() => setMiara(k.klucz)}
              // Wybrany: biały z dolną kreską w cieniu, więc fokus to obrys (nie cień)
              className={cn(
                "relative cursor-pointer border-0 px-5 py-3.5 text-left outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                i > 0 && "border-l border-border",
                wlaczony
                  ? "bg-white shadow-[inset_0_-2px_0_var(--foreground)]"
                  : "bg-black/[.025]",
              )}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {k.etykieta}
              </div>
              <div className="mt-1.5 text-xl font-semibold text-foreground tabular-nums">
                {k.wartosc}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {k.dopisek}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-5 pt-4 pb-3.5">
        <div className="mb-[18px] flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{tytul}</span>
          <span className="text-xs text-muted-foreground">{notka}</span>
        </div>
        <div className="relative flex h-[150px] items-end gap-2.5 border-b border-border">
          {cel !== null && (
            <>
              <div
                data-testid="linia-celu"
                className="absolute right-0 left-0 z-[1] border-t border-dashed border-success"
                style={{ bottom: liniaCelu }}
              />
              {/* Podpis celu jako odznaka; białe tło pod półprzezroczystym zielonym, by tekst był czytelny nad słupkiem */}
              <span
                className="absolute right-0 z-[2] flex rounded-sm bg-white"
                style={{ bottom: liniaCelu + 4 }}
              >
                <StatusBadge tone="green">{celTekst}</StatusBadge>
              </span>
            </>
          )}
          {wartosci.map((v, i) => {
            const ostatni = i === wartosci.length - 1;
            const trafiony = cel !== null && v >= cel;
            const wl = aktywny === i;
            const wys = Math.max(2, v > 0 ? wysokosc(v) : 2);
            const tydzien = tygodnie[i];
            // Daty tygodnia DD.MM–DD.MM z IsoDate (RRRR-MM-DD)
            const od = `${tydzien.od.slice(8, 10)}.${tydzien.od.slice(5, 7)}`;
            const doDnia = addDays(tydzien.od, 6);
            const zakres = `tydz. ${tydzien.numer} · ${od}–${doDnia.slice(8, 10)}.${doDnia.slice(5, 7)}${ostatni ? " (bieżący)" : ""}`;
            // Porównanie z celem (km) albo planem (treningi); tempo i kcal nie mają celu
            const porownanie =
              v <= 0
                ? "brak treningów"
                : cel === null
                  ? ""
                  : trafiony
                    ? miara === "sessions"
                      ? "plan osiągnięty"
                      : "cel osiągnięty"
                    : miara === "sessions"
                      ? `do planu brakuje ${cel - v}`
                      : `do celu brakuje ${format(Math.round((cel - v) * 10) / 10)}${jednostka}`;
            return (
              <div
                key={i}
                tabIndex={0}
                aria-label={`tydz. ${tydzien.numer}: ${format(v)}`}
                onMouseEnter={() => setAktywny(i)}
                onMouseLeave={() => setAktywny(null)}
                onFocus={() => setAktywny(i)}
                onBlur={() => setAktywny(null)}
                // Kolumna tygodnia: cała wysokość wykresu reaguje na kursor; fokus jako obrys
                className={cn(
                  "relative -mx-[3px] flex flex-1 items-end self-stretch rounded-t-md px-[3px] outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring",
                  wl && "bg-black/[.035]",
                )}
              >
                <div
                  data-testid="slupek"
                  title={`tydz. ${tydzien.numer}: ${format(v)}`}
                  className={cn(
                    "relative flex-1 rounded-t-[4px] transition-colors duration-100",
                    ostatni
                      ? wl
                        ? "bg-success brightness-[.85]"
                        : "bg-success"
                      : trafiony
                        ? wl
                          ? "bg-black"
                          : "bg-foreground"
                        : wl
                          ? "bg-black/[.28]"
                          : "bg-black/12",
                  )}
                  style={{ height: wys }}
                >
                  <span
                    className={cn(
                      "absolute -top-[17px] right-0 left-0 text-center text-[10px] whitespace-nowrap tabular-nums",
                      wl
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {v > 0 ? format(v) : ""}
                  </span>
                </div>
                {wl && (
                  <div
                    role="tooltip"
                    data-testid="dymek-tygodnia"
                    // Dymek nad słupkiem; przy skrajnych tygodniach otwiera się do środka
                    className={cn(
                      "pointer-events-none absolute z-[5] rounded-lg border border-border bg-white px-2.5 py-2 text-left whitespace-nowrap shadow-lg",
                      i >= wartosci.length - 3
                        ? "right-0"
                        : i <= 1
                          ? "left-0"
                          : "left-1/2 -translate-x-1/2",
                    )}
                    style={{ bottom: wys + 24 }}
                  >
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {zakres}
                    </div>
                    <div className="mt-0.5 text-[15px] font-semibold tabular-nums">
                      {v > 0 ? `${format(v)}${jednostka}` : "—"}
                    </div>
                    {porownanie && (
                      <div
                        className={cn(
                          "mt-0.5 text-xs tabular-nums",
                          v > 0 && trafiony
                            ? "text-success"
                            : "text-muted-foreground",
                        )}
                      >
                        {porownanie}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>tydz. {tygodnie[0].numer}</span>
          <span>tydz. {tygodnie[11].numer}</span>
        </div>
      </div>
    </section>
  );
}
