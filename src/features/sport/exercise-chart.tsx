"use client";

// Wykres szczegółów ćwiczenia (S2ExerciseDetail): linia z punktami, po najechaniu pionowa linia i dymek.
import { useState } from "react";

import { cn } from "@/lib/utils";

export type ChartPoint = {
  id: string;
  label: string; // oś X, „12.11”
  date: string; // dymek, „czw 12.11.2026”
  value: number;
  detail: string; // „najlepsza seria 72,5 × 5” albo „4 serie”
};

export function ExerciseChart({ points, format }: { points: ChartPoint[]; format: (v: number) => string }) {
  const [wskazany, setWskazany] = useState<number | null>(null);
  const n = points.length;
  const wartosci = points.map((p) => p.value);
  const min = Math.min(...wartosci);
  const max = Math.max(...wartosci);
  // Margines 8%, a dla płaskiej linii stały zapas, żeby nie dzielić przez zero
  const zapas = (max - min || Math.abs(max) || 1) * 0.08;
  const dol = min - zapas;
  const gora = max + zapas;
  const y = (v: number) => 100 - ((v - dol) / (gora - dol)) * 100;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const linia = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const tip = wskazany !== null && wskazany < n ? wskazany : null;
  // Najwyżej ok. 9 podpisów osi, zawsze z ostatnim
  const co = Math.ceil(n / 9);

  return (
    <div className="pr-14">
      <div
        role="img"
        aria-label={`Wykres: od ${format(points[0].value)} do ${format(points[n - 1].value)}`}
        className="relative h-[200px]"
        onMouseLeave={() => setWskazany(null)}
      >
        {[min, (min + max) / 2, max].map((v, i) => (
          <div key={i} aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-black/[.08]" style={{ top: `${y(v)}%` }}>
            <span className="absolute -right-14 w-12 -translate-y-1/2 text-right text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">{format(v)}</span>
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" className="absolute inset-0 block overflow-visible">
          <polygon points={`${x(0)},100 ${linia} ${x(n - 1)},100`} fill="rgba(38,38,38,.05)" />
          <polyline points={linia} fill="none" stroke="#262626" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {tip !== null && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 border-l border-black/15" style={{ left: `${x(tip)}%` }} />}
        {points.map((p, i) => (
          <span
            key={p.id}
            data-testid="punkt-wykresu"
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute box-border -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
              i === n - 1 ? "border-white bg-success shadow-[0_0_0_1px_var(--success)]" : "border-[#262626] bg-white",
              tip === i ? "size-2.5" : i === n - 1 ? "size-[9px]" : "size-[7px]",
            )}
            style={{ left: `${x(i)}%`, top: `${y(p.value)}%` }}
          />
        ))}
        {points.map((p, i) => {
          const od = i === 0 ? 0 : (x(i - 1) + x(i)) / 2;
          const doX = i === n - 1 ? 100 : (x(i) + x(i + 1)) / 2;
          return (
            <button
              key={p.id}
              type="button"
              aria-label={`${p.date}: ${format(p.value)}, ${p.detail}`}
              onMouseEnter={() => setWskazany(i)}
              onFocus={() => setWskazany(i)}
              onBlur={() => setWskazany(null)}
              className="absolute inset-y-0 cursor-default border-0 bg-transparent p-0 outline-none"
              style={{ left: `${od}%`, width: `${doX - od}%` }}
            />
          );
        })}
        {tip !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 rounded-[10px] border border-border bg-white px-3 py-2 whitespace-nowrap shadow-lg"
            style={{ left: `${x(tip)}%`, transform: x(tip) > 75 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
          >
            <div className="text-xs text-muted-foreground tabular-nums">{points[tip].date}</div>
            <div className="mt-0.5 font-semibold tabular-nums">{format(points[tip].value)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{points[tip].detail}</div>
          </div>
        )}
      </div>
      <div className="relative mt-2 h-[18px] text-[11px] text-muted-foreground">
        {points.map((p, i) =>
          (n - 1 - i) % co === 0 ? (
            <span
              key={p.id}
              className={cn("absolute top-0 whitespace-nowrap tabular-nums", tip === i && "text-foreground")}
              style={{ left: `${x(i)}%`, transform: n === 1 ? "translateX(-50%)" : i === 0 ? "none" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
            >
              {p.label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
