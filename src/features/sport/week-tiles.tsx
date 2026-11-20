"use client";

// Kafelki bieżącego tygodnia i wykres 12 ostatnich tygodni (Sport.dc.html, „STATYSTYKI”, lewa karta).
// Kafelek jest przełącznikiem wykresu; linia celu tylko dla km i treningów przy włączonym celu.
import { useState } from "react";

import { MonoLabel } from "@/components/controls";
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

  // 12 tygodni od profiles.week_start; ostatni = bieżący
  const dzien = weekdayOf(today);
  const biezacy = addDays(
    today,
    -(profile.weekStart === "mon" ? dzien - 1 : dzien % 7),
  );
  const tygodnie = Array.from({ length: 12 }, (_, i) => {
    const od = addDays(biezacy, (i - 11) * 7);
    // Numer ISO ze środka tygodnia (przy tygodniu od niedzieli niedziela należy do poprzedniego)
    return { numer: isoWeekNumber(addDays(od, 3)), ...weekStats(items, od) };
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
  } else if (miara === "pace") {
    wartosci = tygodnie.map((t) => t.paceS ?? 0);
    tytul = "Średnie tempo biegów";
    notka = "wyższy słupek = szybciej";
    format = (v) => formatPace(v);
  } else if (miara === "sessions") {
    wartosci = tygodnie.map((t) => t.done);
    tytul = "Treningi tygodniowo";
    notka = "bieg + siłownia";
    if (profile.workoutsGoalOn) {
      cel = profile.weeklyWorkoutsGoal;
      celTekst = `plan ${profile.weeklyWorkoutsGoal}`;
    }
    format = (v) => String(v);
  } else {
    wartosci = tygodnie.map((t) => t.kcal);
    tytul = "Spalone kcal tygodniowo";
    notka = "biegi, wzór ACSM";
    format = (v) => v.toLocaleString("pl-PL");
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
    <section className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="grid grid-cols-4 border-b border-border">
        {kafelki.map((k, i) => {
          const wlaczony = miara === k.klucz;
          return (
            <button
              key={k.klucz}
              type="button"
              aria-pressed={wlaczony}
              onClick={() => setMiara(k.klucz)}
              className={cn(
                "cursor-pointer border-0 px-4 py-3.5 text-left outline-none focus-visible:shadow-focus-inset",
                i > 0 && "border-l border-border",
                wlaczony
                  ? "bg-white shadow-[inset_0_-2px_0_#171717]"
                  : "bg-panel",
              )}
            >
              <MonoLabel className="block">{k.etykieta}</MonoLabel>
              <div className="mt-1.5 font-mono text-xl text-foreground">
                {k.wartosc}{" "}
                <span className="text-xs text-muted-foreground">{k.dopisek}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-4 pt-3.5 pb-3">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-medium">{tytul}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{notka}</span>
        </div>
        <div className="relative flex h-[150px] items-end gap-2.5 border-b border-border">
          {cel !== null && (
            <>
              <div
                data-testid="linia-celu"
                className="absolute right-0 left-0 z-[1] border-t border-dashed border-success"
                style={{ bottom: liniaCelu }}
              />
              <span
                className="absolute right-0 z-[2] bg-white px-1 font-mono text-[10px] text-success"
                style={{ bottom: liniaCelu + 4 }}
              >
                {celTekst}
              </span>
            </>
          )}
          {wartosci.map((v, i) => {
            const ostatni = i === wartosci.length - 1;
            const trafiony = cel !== null && v >= cel;
            return (
              <div
                key={i}
                data-testid="slupek"
                title={`tydz. ${tygodnie[i].numer}: ${format(v)}`}
                className="relative flex-1 rounded-t-[3px]"
                style={{
                  height: Math.max(2, v > 0 ? wysokosc(v) : 2),
                  background: ostatni
                    ? "#15803d"
                    : trafiony
                      ? "#171717"
                      : "#d4d4d4",
                }}
              >
                <span className="absolute -top-4 right-0 left-0 text-center font-mono text-[9px] whitespace-nowrap text-muted-foreground">
                  {v > 0 ? format(v) : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>tydz. {tygodnie[0].numer}</span>
          <span>tydz. {tygodnie[11].numer}</span>
        </div>
      </div>
    </section>
  );
}
