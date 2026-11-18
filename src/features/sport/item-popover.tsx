"use client";

// Dymek treningu w kalendarzu Sportu (Sport.dc.html, `d.pop`): typ i stan, tytuł, termin,
// statystyki, lista ćwiczeń, notatka oraz akcje. Stoi obok komórki dnia (position: absolute);
// w prawych kolumnach otwiera się w lewo, w dolnych wierszach w górę.
import Link from "next/link";

import type { IsoDate } from "@/components/controls/calendar-math";
import { weekdayOf } from "@/features/calendar/view-range";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import type { GymSessionInput } from "./actions";
import type { SessionSets, TemplateWithItems } from "./load-sport";
import {
  formatDuration,
  formatKg,
  formatKm,
  formatPace,
  formatVolume,
  recordSetIds,
  type ExerciseRow,
  type SportItem,
} from "./model";

// Okno biegu (Task 5): edycja sesji albo nowy bieg w danym dniu i godzinie
export type RunRequest =
  | { sessionId: string }
  | { date: IsoDate; start: string };

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const ODZNAKA_BIEGU = "border border-[#fed7aa] bg-[#fff4ed] text-[#c2410c]";
const ODZNAKA_SILY = "border border-[#e0e0e0] bg-[#f5f5f5] text-[#404040]";

export function ItemPopover({
  item,
  openLeft,
  openUp,
  clock,
  templates,
  exercises,
  setsHistory,
  onClose,
  onOpenRun,
  onStartGym,
  onDelete,
}: {
  item: SportItem;
  openLeft: boolean;
  openUp: boolean;
  clock: "24" | "12";
  templates: TemplateWithItems[];
  exercises: ExerciseRow[];
  setsHistory: SessionSets[];
  onClose: () => void;
  onOpenRun: (req: RunRequest) => void;
  onStartGym: (input: GymSessionInput) => void;
  onDelete: (item: SportItem) => void;
}) {
  const bieg = item.kind === "run";
  const godzina = (min: number) =>
    formatClockTime(Math.floor(min / 60), min % 60, clock);
  const koniecMin = Math.min(item.startMin + item.durationMin, 1440);
  const [rok, miesiac, dzien] = item.date.split("-");
  // „nd 15.11.2026 · 09:00–10:30”
  const kiedy = `${DNI[weekdayOf(item.date)]} ${dzien}.${miesiac}.${rok} · ${godzina(item.startMin)}–${godzina(koniecMin)}`;

  const nazwyCwiczen = new Map(exercises.map((e) => [e.id, e.name]));
  const szablon = item.templateId
    ? (templates.find((t) => t.id === item.templateId) ?? null)
    : null;
  const serieSesji = item.sessionId
    ? (setsHistory.find((s) => s.sessionId === item.sessionId)?.sets ?? [])
    : [];
  // Ćwiczenia sesji w kolejności z treningu
  const idCwiczen: string[] = [];
  for (const s of [...serieSesji].sort(
    (a, b) => a.exercise_position - b.exercise_position,
  )) {
    if (!idCwiczen.includes(s.exercise_id)) idCwiczen.push(s.exercise_id);
  }

  let statystyki: { k: string; v: string }[];
  let lista: { n: string; v: string }[] = [];

  if (bieg && !item.planned) {
    const km = item.distanceKm ?? 0;
    const czas = item.durationS ?? 0;
    statystyki = [
      { k: "Dystans", v: `${formatKm(km)} km` },
      { k: "Czas", v: formatDuration(czas) },
      { k: "Tempo", v: km > 0 ? `${formatPace(czas / km)} /km` : "—" },
      { k: "Kcal", v: item.kcal !== null ? `≈ ${item.kcal}` : "—" },
      {
        k: "Trudność",
        v: item.difficulty !== null ? `${item.difficulty}/10` : "—",
      },
      { k: "Godzina", v: godzina(item.startMin) },
    ];
  } else if (bieg) {
    statystyki = [
      {
        k: "Plan",
        v:
          item.distanceKm !== null
            ? `${String(item.distanceKm).replace(".", ",")} km`
            : "—",
      },
      { k: "Start", v: godzina(item.startMin) },
      { k: "Tempo", v: "—" },
      { k: "Kcal", v: "—" },
    ];
  } else if (item.planned) {
    // Plan siłowy: wystąpienie szablonu (pozycje szablonu) albo sesja jeszcze niezakończona (jej serie)
    if (!item.sessionId && szablon) {
      statystyki = [
        { k: "Szablon", v: szablon.name },
        { k: "Start", v: godzina(item.startMin) },
        { k: "Ćwiczenia", v: String(szablon.items.length) },
        {
          k: "Serie",
          v: String(szablon.items.reduce((suma, p) => suma + p.sets_count, 0)),
        },
      ];
      lista = szablon.items.map((p) => ({
        n: p.exerciseName,
        v: "jak ostatnio",
      }));
    } else {
      statystyki = [
        { k: "Szablon", v: szablon ? szablon.name : "—" },
        { k: "Start", v: godzina(item.startMin) },
        { k: "Ćwiczenia", v: String(idCwiczen.length) },
        { k: "Serie", v: String(serieSesji.length) },
      ];
      lista = idCwiczen.map((id) => ({
        n: nazwyCwiczen.get(id) ?? "",
        v: "jak ostatnio",
      }));
    }
    lista = lista.slice(0, 4);
  } else {
    // Trening wykonany: objętość, serie zrobione / wszystkie, rekordy i najlepsza seria każdego ćwiczenia
    let objetosc = 0;
    let zrobione = 0;
    for (const s of serieSesji) {
      if (!s.done) continue;
      zrobione += 1;
      if (s.weight_kg !== null && s.reps !== null)
        objetosc += s.weight_kg * s.reps;
    }
    let rekordy = 0;
    for (const id of idCwiczen) {
      const rekordoweSerie = recordSetIds(setsHistory, id);
      for (const s of serieSesji) if (rekordoweSerie.has(s.id)) rekordy += 1;
    }
    statystyki = [
      { k: "Ćwiczenia", v: String(idCwiczen.length) },
      { k: "Serie", v: `${zrobione} / ${serieSesji.length}` },
      { k: "Objętość", v: `${formatVolume(objetosc)} kg` },
      { k: "Czas", v: formatDuration(item.durationMin * 60) },
      {
        k: "Trudność",
        v: item.difficulty !== null ? `${item.difficulty}/10` : "—",
      },
      { k: "Rekordy", v: String(rekordy) },
    ];
    lista = idCwiczen.slice(0, 5).map((id) => {
      // Najlepsza seria: najcięższa zrobiona (przy remisie więcej powtórzeń); bez ciężaru — najwięcej powtórzeń
      let najlepsza: (typeof serieSesji)[number] | null = null;
      for (const s of serieSesji) {
        if (s.exercise_id !== id || !s.done || s.reps === null) continue;
        if (
          najlepsza === null ||
          (s.weight_kg ?? 0) > (najlepsza.weight_kg ?? 0) ||
          ((s.weight_kg ?? 0) === (najlepsza.weight_kg ?? 0) &&
            s.reps > (najlepsza.reps ?? 0))
        ) {
          najlepsza = s;
        }
      }
      return {
        n: nazwyCwiczen.get(id) ?? "",
        v: najlepsza
          ? `${formatKg(najlepsza.weight_kg)} × ${najlepsza.reps}`
          : "—",
      };
    });
  }

  const akcja =
    "inline-flex cursor-pointer items-center rounded-md px-3 py-[7px] text-[13px] whitespace-nowrap no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20";
  const glowna = `${akcja} border border-[#171717] bg-[#171717] font-medium text-white hover:bg-[#2e2e2e] hover:text-white`;

  return (
    <div
      role="dialog"
      aria-label={item.title}
      className={cn(
        "absolute z-20 box-border w-[300px] cursor-default rounded-xl border border-[#e0e0e0] bg-white px-4 py-3.5 text-left text-sm text-[#171717] shadow-[0_16px_48px_rgba(0,0,0,.16)]",
        openLeft ? "right-[calc(100%+6px)]" : "left-[calc(100%+6px)]",
        openUp ? "bottom-0" : "top-0",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded px-1.5 py-px font-mono text-[10px]",
            bieg ? ODZNAKA_BIEGU : ODZNAKA_SILY,
          )}
        >
          {bieg ? "BIEG" : "SIŁA"}
        </span>
        <span className="font-mono text-[11px] whitespace-nowrap text-[#6b6b6b]">
          {item.planned ? "zaplanowany" : "wykonany"}
          {item.showInCalendar && " · w kalendarzu"}
        </span>
        <button
          type="button"
          aria-label="Zamknij"
          onClick={onClose}
          className="ml-auto size-[26px] cursor-pointer rounded-md border border-[#e0e0e0] bg-white text-xs text-[#666666] outline-none hover:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-[#171717]/20"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 text-[15px] font-semibold">{item.title}</div>
      <div className="mt-0.5 font-mono text-xs text-[#666666]">{kiedy}</div>

      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#eaeaea] bg-[#eaeaea]">
        {statystyki.map((st) => (
          <div key={st.k} className="bg-white px-2.5 py-2">
            <div className="font-mono text-[10px] tracking-[0.06em] text-[#6b6b6b] uppercase">
              {st.k}
            </div>
            <div className="mt-0.5 font-mono text-sm font-medium">{st.v}</div>
          </div>
        ))}
      </div>

      {lista.length > 0 && (
        <div className="mt-3 flex flex-col gap-1 text-xs">
          {lista.map((c, i) => (
            <div key={i} className="flex gap-2">
              <span className="min-w-0 flex-1 truncate">{c.n}</span>
              <span className="font-mono text-[#666666]">{c.v}</span>
            </div>
          ))}
        </div>
      )}

      {item.note && (
        <div className="mt-3 rounded-md bg-[#fafafa] px-2.5 py-2 text-xs text-[#404040]">
          {item.note}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-[#eaeaea] pt-3">
        {bieg ? (
          <button
            type="button"
            className={glowna}
            onClick={() => onOpenRun({ sessionId: item.sessionId ?? "" })}
          >
            {item.planned ? "Uzupełnij dane" : "Edytuj"}
          </button>
        ) : item.sessionId ? (
          <Link href={`/sport/trening/${item.sessionId}`} className={glowna}>
            {item.planned ? "Rozpocznij" : "Otwórz trening"}
          </Link>
        ) : (
          <button
            type="button"
            className={glowna}
            onClick={() =>
              onStartGym({
                date: item.date,
                start: `${String(Math.floor(item.startMin / 60)).padStart(2, "0")}:${String(item.startMin % 60).padStart(2, "0")}`,
                templateId: item.templateId ?? undefined,
              })
            }
          >
            Rozpocznij
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(item)}
          className={`${akcja} border border-[#e0e0e0] bg-white text-[#b91c1c] hover:bg-[#fafafa]`}
        >
          Usuń
        </button>
      </div>
    </div>
  );
}
