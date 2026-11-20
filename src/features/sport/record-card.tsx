"use client";

// Karta rekordu (Sport.dc.html, „STATYSTYKI”, prawa karta): szac. 1RM, najlepsza seria
// i mini wykres ostatnich sesji ćwiczenia z dymkiem po najechaniu. Dropdown nad kartą zmienia ćwiczenie.
import { useState } from "react";
import Link from "next/link";

import { Dropdown, MonoLabel } from "@/components/controls";
import { weekdayOf } from "@/features/calendar/view-range";
import type { SessionSets } from "./load-sport";
import {
  effectiveKg,
  epley1rm,
  formatKg,
  recordSetIds,
  type ExerciseRow,
} from "./model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const MIESIACE_KROTKO = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
];
const PUNKTY = 8; // ostatnie sesje na wykresie

// 82.5 -> "82,5", 72 -> "72,0" (jak `kg` w makiecie)
const kg = (v: number) => v.toFixed(1).replace(".", ",");

export function RecordCard({
  exercises,
  setsHistory,
  profileWeight,
  onNewGym,
}: {
  exercises: ExerciseRow[];
  setsHistory: SessionSets[];
  // Waga z profilu: ćwiczenia z masą ciała liczą wagę + dociążenie (null = bez 1RM)
  profileWeight: number | null;
  // „+ Trening siłowy” w pustej karcie
  onNewGym: () => void;
}) {
  // Tylko zakończone treningi (przyszły / niedokończony z odhaczoną serią nie jest historią)
  const zakonczone = setsHistory.filter((h) => h.completed);
  const zMasaCiala = new Set(
    exercises.filter((e) => e.bodyweight).map((e) => e.id),
  );
  // Ćwiczenia z liczbą sesji, w których mają zrobioną serię z ciężarem (i powt. ≥ 1, czyli punkt 1RM)
  const sesjeCwiczen = new Map<string, number>();
  for (const sesja of zakonczone) {
    const wSesji = new Set<string>();
    for (const s of sesja.sets) {
      const ef = effectiveKg(
        s.weight_kg,
        zMasaCiala.has(s.exercise_id),
        profileWeight,
      );
      if (s.done && ef !== null && s.reps !== null && s.reps >= 1)
        wSesji.add(s.exercise_id);
    }
    for (const id of wSesji)
      sesjeCwiczen.set(id, (sesjeCwiczen.get(id) ?? 0) + 1);
  }
  const zCiezarem = exercises.filter((e) => sesjeCwiczen.has(e.id));
  // Domyślnie ćwiczenie z największą liczbą sesji
  let domyslne: ExerciseRow | null = null;
  for (const e of zCiezarem) {
    if (
      domyslne === null ||
      (sesjeCwiczen.get(e.id) ?? 0) > (sesjeCwiczen.get(domyslne.id) ?? 0)
    )
      domyslne = e;
  }

  const [wybraneId, setWybraneId] = useState<string | null>(null);
  const [najechany, setNajechany] = useState<number | null>(null);
  const cwiczenie =
    zCiezarem.find((e) => e.id === wybraneId) ?? domyslne ?? null;

  if (!cwiczenie) {
    return (
      <section className="flex flex-col items-start justify-center gap-2 rounded-lg border border-border bg-white px-4 py-3.5">
        <p className="m-0 text-[13px] text-muted-foreground">
          Brak treningów siłowych.
        </p>
        <button
          type="button"
          onClick={onNewGym}
          className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/20"
        >
          + Trening siłowy
        </button>
      </section>
    );
  }

  // Punkty: najlepszy 1RM każdej sesji (z serii z ciężarem i powt. ≥ 1), ostatnie PUNKTY sesji
  const rekordowe = recordSetIds(
    setsHistory,
    cwiczenie.id,
    cwiczenie.bodyweight,
    profileWeight,
  );
  const wszystkie: {
    when: string;
    miesiac: number;
    v: number;
    seria: string;
    rekord: boolean;
  }[] = [];
  for (const sesja of zakonczone) {
    let najlepszy: { v: number; seria: string } | null = null;
    let rekord = false;
    for (const s of sesja.sets) {
      if (s.exercise_id !== cwiczenie.id || !s.done) continue;
      if (rekordowe.has(s.id)) rekord = true;
      const ef = effectiveKg(s.weight_kg, cwiczenie.bodyweight, profileWeight);
      if (ef === null || s.reps === null || s.reps < 1) continue;
      const v = epley1rm(ef, s.reps);
      if (najlepszy === null || v > najlepszy.v)
        najlepszy = {
          v,
          seria: `${formatKg(s.weight_kg, cwiczenie.bodyweight)} × ${s.reps}`,
        };
    }
    if (!najlepszy) continue;
    const [rok, mm, dd] = sesja.startLocal.slice(0, 10).split("-");
    wszystkie.push({
      when: `${DNI[weekdayOf(sesja.startLocal.slice(0, 10))]} ${dd}.${mm}.${rok}`,
      miesiac: Number(mm),
      v: najlepszy.v,
      seria: najlepszy.seria,
      rekord,
    });
  }
  const punkty = wszystkie.slice(-PUNKTY);

  // Skala wykresu 300 × 110 jak w makiecie: x od 5 do 290, y od 100 (dół) do 10 (góra)
  const najmniej = Math.min(...punkty.map((p) => p.v)) - 2;
  const najwiecej = Math.max(...punkty.map((p) => p.v)) + 2;
  const px = (i: number) =>
    punkty.length > 1 ? 5 + i * (285 / (punkty.length - 1)) : 150;
  const py = (v: number) =>
    100 - ((v - najmniej) / (najwiecej - najmniej)) * 90;
  const szerStrefy = 285 / Math.max(1, punkty.length - 1);

  const hov = najechany !== null ? (punkty[najechany] ?? null) : null;
  const biezacy = hov ?? punkty[punkty.length - 1];
  const poprzedni =
    najechany !== null && najechany > 0 ? punkty[najechany - 1] : null;
  const roznica = hov && poprzedni ? hov.v - poprzedni.v : 0;

  return (
    <div className="flex flex-col gap-2">
      {zCiezarem.length > 1 && (
        <div className="self-end">
          <Dropdown
            ariaLabel="Ćwiczenie"
            width={220}
            value={cwiczenie.id}
            onChange={(id) => {
              setWybraneId(id);
              setNajechany(null);
            }}
            options={zCiezarem.map((e) => ({ value: e.id, label: e.name }))}
          />
        </div>
      )}
      <section className="flex flex-1 flex-col rounded-lg border border-border bg-white px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[15px] font-semibold">
            <Link
              href={`/sport/cwiczenia/${cwiczenie.id}`}
              className="text-foreground no-underline hover:underline"
            >
              {cwiczenie.name}
            </Link>
          </h2>
          <span
            className={
              biezacy.rekord
                ? "rounded border border-success-border bg-success-soft px-1.5 py-px font-mono text-[11px] text-success"
                : "rounded border border-input bg-panel px-1.5 py-px font-mono text-[11px] text-muted-foreground"
            }
          >
            {biezacy.rekord ? "REKORD" : "bez rekordu"}
          </span>
        </div>
        <div className="mt-3 flex items-end gap-6">
          <div>
            <MonoLabel className="block">Szac. 1RM</MonoLabel>
            <div className="mt-1 font-mono text-xl">{`${kg(biezacy.v)} kg`}</div>
          </div>
          <div>
            <MonoLabel className="block">Najlepsza seria</MonoLabel>
            <div className="mt-1 font-mono text-xl">{biezacy.seria}</div>
          </div>
          <div className="ml-auto pb-[3px] font-mono text-[11px] text-muted-foreground">
            {hov ? biezacy.when : `ostatnio: ${biezacy.when}`}
          </div>
        </div>

        <div
          className="relative mt-auto pt-3"
          onMouseLeave={() => setNajechany(null)}
        >
          <div className="relative h-[110px]">
            <svg
              viewBox="0 0 300 110"
              preserveAspectRatio="none"
              width="100%"
              height="110"
              role="img"
              aria-label={`Szacowany 1RM: od ${kg(punkty[0].v)} do ${kg(punkty[punkty.length - 1].v)} kg w ostatnich ${punkty.length} sesjach`}
              className="absolute inset-0 block"
            >
              <line
                x1="0"
                y1="100"
                x2="300"
                y2="100"
                stroke="#eaeaea"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="0"
                y1="55"
                x2="300"
                y2="55"
                stroke="#f0f0f0"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="0"
                y1="10"
                x2="300"
                y2="10"
                stroke="#f0f0f0"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={punkty
                  .map((p, i) => `${px(i).toFixed(1)},${py(p.v).toFixed(1)}`)
                  .join(" ")}
                fill="none"
                stroke="#171717"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="[stroke-dasharray:600] [animation:rh-draw_1.2s_cubic-bezier(.22,1,.36,1)_both]"
              />
            </svg>
            {hov && najechany !== null && (
              <div
                className="pointer-events-none absolute top-1 bottom-2.5 w-0 border-l border-dashed border-ring"
                style={{ left: `${(px(najechany) / 3).toFixed(2)}%` }}
              />
            )}
            {punkty.map((p, i) => {
              const wlaczony = najechany === i;
              const kolor = p.rekord ? "#15803d" : "#171717";
              return (
                <span
                  key={`kropka-${i}`}
                  className="pointer-events-none absolute box-border -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height] duration-[120ms]"
                  style={{
                    width: wlaczony ? 11 : 7,
                    height: wlaczony ? 11 : 7,
                    left: `${(px(i) / 3).toFixed(2)}%`,
                    top: `${py(p.v).toFixed(1)}px`,
                    border: `2px solid ${kolor}`,
                    background: wlaczony ? kolor : "#ffffff",
                  }}
                />
              );
            })}
            {punkty.map((p, i) => (
              <button
                key={`strefa-${i}`}
                type="button"
                aria-label={`${p.when}: ${kg(p.v)} kg`}
                onMouseEnter={() => setNajechany(i)}
                onFocus={() => setNajechany(i)}
                onClick={() => setNajechany(i)}
                className="absolute top-0 bottom-0 cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:bg-primary/5"
                style={{
                  left: `${((px(i) - szerStrefy / 2) / 3).toFixed(2)}%`,
                  width: `${(szerStrefy / 3).toFixed(2)}%`,
                }}
              />
            ))}
          </div>
          {hov && najechany !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-[5] rounded-lg border border-input bg-white px-2.5 py-2 whitespace-nowrap shadow-[0_8px_24px_rgba(0,0,0,.1)] [animation:rh-fade_.12s_ease-out]"
              style={{
                top: Math.round(
                  py(hov.v) < 55 ? 12 + py(hov.v) + 14 : 12 + py(hov.v) - 100,
                ),
                ...(najechany >= punkty.length / 2
                  ? { right: `calc(${100 - px(najechany) / 3}% + 10px)` }
                  : { left: `calc(${px(najechany) / 3}% + 10px)` }),
              }}
            >
              <div className="font-mono text-[11px] text-muted-foreground">
                {hov.when}
              </div>
              <div className="mt-0.5 font-mono text-sm font-semibold">
                {kg(hov.v)} kg{" "}
                <span className="text-[11px] font-normal text-muted-foreground">
                  szac. 1RM
                </span>
              </div>
              <div className="mt-0.5 font-mono text-xs">seria {hov.seria}</div>
              <div
                className="mt-0.5 font-mono text-[11px]"
                style={{
                  color: poprzedni && roznica < 0 ? "#b91c1c" : "#15803d",
                }}
              >
                {poprzedni
                  ? `${roznica >= 0 ? "+" : "−"}${kg(Math.abs(roznica))} kg vs poprz.`
                  : "pierwszy pomiar"}
              </div>
              {hov.rekord && (
                <div className="mt-1.5 inline-block rounded border border-success-border bg-success-soft px-1.5 py-px font-mono text-[10px] text-success">
                  REKORD
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{MIESIACE_KROTKO[punkty[0].miesiac - 1]}</span>
          <span>{MIESIACE_KROTKO[punkty[punkty.length - 1].miesiac - 1]}</span>
        </div>
      </section>
    </div>
  );
}
