"use client";

// Tabela „Ostatnie treningi” (Sport.dc.html, „OSTATNIE TRENINGI”): 10 ostatnich wykonanych po filtrze.
// Klik w wiersz otwiera trening: bieg — okno biegu, trening siłowy — ekran treningu.
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/controls";
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
// .td / .th z coss.css: wysokość 44 / 40, boczne wcięcie 24 px w pierwszej i ostatniej kolumnie
const KOMORKA = "h-11 border-b border-border px-3 group-last/wiersz:border-b-0";
const NAGLOWEK =
  "h-10 border-b border-border px-3 font-medium whitespace-nowrap text-muted-foreground";

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
    <section className="overflow-hidden rounded-xl border border-border bg-white bg-clip-padding shadow-card">
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3.5">
        <h2 className="m-0 text-base leading-[1.3] font-semibold">
          Ostatnie treningi
        </h2>
        <StatusBadge tone="gray" size="lg" className="tabular-nums">
          {`${MIESIACE[Number(month.slice(5, 7)) - 1]} · ${doneInMonth} wykonanych`}
        </StatusBadge>
      </div>
      <div className="overflow-x-auto border-t border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className={`${NAGLOWEK} pl-6 text-left`}>
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
            <th scope="col" className={`${NAGLOWEK} pr-6 text-right`}>
              Trudność
            </th>
          </tr>
        </thead>
        <tbody>
          {wiersze.length === 0 && (
            <tr className="group/wiersz">
              <td colSpan={5} className={`${KOMORKA} px-6 text-muted-foreground`}>
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
                className="group/wiersz cursor-pointer outline-none hover:bg-black/[.02] focus-visible:bg-black/[.02] focus-visible:shadow-focus-inset"
              >
                <td
                  className={`${KOMORKA} pl-6 text-soft-foreground tabular-nums`}
                >
                  {`${DNI[weekdayOf(item.date)]} ${dd}.${mm}`}
                </td>
                <td className={KOMORKA}>
                  <StatusBadge tone={bieg ? "orange" : "gray"}>
                    {bieg ? "BIEG" : "SIŁA"}
                  </StatusBadge>{" "}
                  <span className="ml-1.5 font-medium">{item.title}</span>
                </td>
                <td
                  className={`${KOMORKA} text-right font-medium tabular-nums`}
                >
                  {wynik}
                </td>
                <td
                  className={`${KOMORKA} text-right text-soft-foreground tabular-nums`}
                >
                  {dodatkowo}
                </td>
                <td
                  className={`${KOMORKA} pr-6 text-right text-muted-foreground tabular-nums`}
                >
                  {item.difficulty !== null ? `${item.difficulty}/10` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </section>
  );
}
