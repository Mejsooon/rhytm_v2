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
  type SportItem,
} from "./model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const KOMORKA = "border-b border-[#f0f0f0] px-4 py-2.5";
const NAGLOWEK =
  "border-b border-[#eaeaea] px-4 py-2 font-medium text-[#666666]";

export function RecentTable({
  items,
  month,
  doneInMonth,
  setsHistory,
  onOpenRun,
}: {
  // Wykonane treningi malejąco, już po filtrze
  items: SportItem[];
  month: string;
  // Wykonane treningi pokazywanego miesiąca (po filtrze)
  doneInMonth: number;
  setsHistory: SessionSets[];
  onOpenRun: (req: RunRequest) => void;
}) {
  const router = useRouter();
  const wiersze = items.slice(0, 10);

  function otworz(item: SportItem) {
    if (!item.sessionId) return;
    if (item.kind === "run") onOpenRun({ sessionId: item.sessionId });
    else router.push(`/sport/trening/${item.sessionId}`);
  }

  return (
    <section className="overflow-x-auto rounded-lg border border-[#eaeaea] bg-white">
      <div className="flex justify-between border-b border-[#eaeaea] px-4 py-3">
        <h2 className="m-0 text-[15px] font-semibold">Ostatnie treningi</h2>
        <span className="font-mono text-xs text-[#666666]">
          {`${MIESIACE[Number(month.slice(5, 7)) - 1]} · ${doneInMonth} wykonanych`}
        </span>
      </div>
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#fafafa]">
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
              <td colSpan={5} className={`${KOMORKA} text-[#666666]`}>
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
              dodatkowo = `${formatVolume(sessionVolume(serie))} kg`;
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
                className="cursor-pointer outline-none hover:bg-[#fafafa] focus-visible:bg-[#fafafa]"
              >
                <td className={`${KOMORKA} font-mono text-[#404040]`}>
                  {`${DNI[weekdayOf(item.date)]} ${dd}.${mm}`}
                </td>
                <td className={KOMORKA}>
                  <span
                    className={
                      bieg
                        ? "rounded border border-[#fed7aa] bg-[#fff4ed] px-1.5 py-px font-mono text-[10px] text-[#c2410c]"
                        : "rounded border border-[#e0e0e0] bg-[#f5f5f5] px-1.5 py-px font-mono text-[10px] text-[#404040]"
                    }
                  >
                    {bieg ? "BIEG" : "SIŁA"}
                  </span>{" "}
                  <span className="ml-1.5">{item.title}</span>
                </td>
                <td className={`${KOMORKA} text-right font-mono`}>{wynik}</td>
                <td
                  className={`${KOMORKA} text-right font-mono text-[#404040]`}
                >
                  {dodatkowo}
                </td>
                <td
                  className={`${KOMORKA} text-right font-mono text-[#666666]`}
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
