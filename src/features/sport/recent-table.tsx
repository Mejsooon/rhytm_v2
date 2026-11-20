"use client";

// Tabela „Ostatnie treningi” (Sport.dc.html, „OSTATNIE TRENINGI”): 10 ostatnich wykonanych po filtrze.
// Klik w wiersz otwiera trening: bieg — okno biegu, trening siłowy — ekran treningu.
import { useRouter } from "next/navigation";

import { MIESIACE } from "@/components/controls/calendar-math";
import { weekdayOf } from "@/features/calendar/view-range";
import type { RunRequest } from "./item-popover";
import type { SessionSets } from "./load-sport";
import {
  formatKm,
  formatPace,
  formatVolume,
  sessionVolume,
  type ExerciseRow,
  type SportItem,
} from "./model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const KOMORKA = "border-b border-border px-4 py-2.5";
const NAGLOWEK =
  "border-b border-border px-4 py-2 font-medium text-muted-foreground";

export function RecentTable({
  items,
  month,
  doneInMonth,
  setsHistory,
  exercises,
  profileWeight,
  onOpenRun,
}: {
  // Wykonane treningi malejąco, już po filtrze
  items: SportItem[];
  month: string;
  // Wykonane treningi pokazywanego miesiąca (po filtrze)
  doneInMonth: number;
  setsHistory: SessionSets[];
  // Ćwiczenia (flaga masy ciała) i waga z profilu do objętości
  exercises: ExerciseRow[];
  profileWeight: number | null;
  onOpenRun: (req: RunRequest) => void;
}) {
  const router = useRouter();
  const zMasaCiala = new Set(
    exercises.filter((e) => e.bodyweight).map((e) => e.id),
  );
  const wiersze = items.slice(0, 10);

  function otworz(item: SportItem) {
    if (!item.sessionId) return;
    if (item.kind === "run") onOpenRun({ sessionId: item.sessionId });
    else router.push(`/sport/trening/${item.sessionId}`);
  }

  return (
    <section className="overflow-x-auto rounded-lg border border-border bg-white">
      <div className="flex justify-between border-b border-border px-4 py-3">
        <h2 className="m-0 text-[15px] font-semibold">Ostatnie treningi</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {`${MIESIACE[Number(month.slice(5, 7)) - 1]} · ${doneInMonth} wykonanych`}
        </span>
      </div>
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-panel">
            <th scope="col" className={`${NAGLOWEK} text-left`}>
              Data
            </th>
            <th scope="col" className={`${NAGLOWEK} text-left`}>
              Typ
            </th>
            <th scope="col" className={`${NAGLOWEK} text-right`}>
              Wynik
            </th>
            <th scope="col" className={`${NAGLOWEK} text-right`}>
              Tempo / objętość
            </th>
            <th scope="col" className={`${NAGLOWEK} text-right`}>
              Trudność
            </th>
          </tr>
        </thead>
        <tbody>
          {wiersze.length === 0 && (
            <tr>
              <td colSpan={5} className={`${KOMORKA} text-muted-foreground`}>
                Brak wykonanych treningów.
              </td>
            </tr>
          )}
          {wiersze.map((item) => {
            const bieg = item.kind === "run";
            const [, mm, dd] = item.date.split("-");
            let wynik: string;
            let dodatkowo: string;
            if (bieg) {
              const km = item.distanceKm ?? 0;
              wynik = `${formatKm(km)} km`;
              dodatkowo =
                km > 0 && item.durationS !== null
                  ? `${formatPace(item.durationS / km)}/km`
                  : "—";
            } else {
              const serie =
                setsHistory.find((s) => s.sessionId === item.sessionId)?.sets ??
                [];
              wynik = `${new Set(serie.map((s) => s.exercise_id)).size} ćw.`;
              dodatkowo = `${formatVolume(sessionVolume(serie, zMasaCiala, profileWeight))} kg`;
            }
            return (
              <tr
                key={item.key}
                tabIndex={0}
                onClick={() => otworz(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    otworz(item);
                  }
                }}
                className="cursor-pointer outline-none hover:bg-panel focus-visible:bg-panel"
              >
                <td className={`${KOMORKA} font-mono text-soft-foreground`}>
                  {`${DNI[weekdayOf(item.date)]} ${dd}.${mm}`}
                </td>
                <td className={KOMORKA}>
                  <span
                    className={
                      bieg
                        ? "rounded border border-warning-border bg-warning-soft px-1.5 py-px font-mono text-[10px] text-warning-foreground"
                        : "rounded border border-input bg-muted px-1.5 py-px font-mono text-[10px] text-soft-foreground"
                    }
                  >
                    {bieg ? "BIEG" : "SIŁA"}
                  </span>{" "}
                  <span className="ml-1.5">{item.title}</span>
                </td>
                <td className={`${KOMORKA} text-right font-mono`}>{wynik}</td>
                <td
                  className={`${KOMORKA} text-right font-mono text-soft-foreground`}
                >
                  {dodatkowo}
                </td>
                <td
                  className={`${KOMORKA} text-right font-mono text-muted-foreground`}
                >
                  {item.difficulty !== null ? `${item.difficulty}/10` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
