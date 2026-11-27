"use client";

// Prawa kolumna widoku dnia (S2Calendar, „Plan dnia”): trzy liczby i lista bloków dnia.
// Klik w pozycję otwiera ten sam dymek co blok w siatce.
import { Card } from "@/components/controls";
import { formatClockTime } from "@/lib/time/timezones";
import { occurrenceProgress, type TaskRow } from "@/features/tasks/model";
import type { CategoryRow } from "./load-calendar";
import type { Occurrence } from "./occurrences";

export function DaySide({
  occurrences,
  tasks,
  categories,
  clock,
  onBlockClick,
}: {
  // Widoczne wystąpienia pokazanego dnia
  occurrences: Occurrence[];
  tasks: TaskRow[];
  categories: CategoryRow[];
  clock: "24" | "12";
  onBlockClick: (key: string, anchor: HTMLElement) => void;
}) {
  const pozycje = [...occurrences]
    .sort((a, b) => a.startMin - b.startMin)
    // Zadania wiszą na oryginalnej dacie wystąpienia z klucza (blok mógł zostać przesunięty)
    .map((o) => ({ o, postep: occurrenceProgress(tasks, o.blockId, o.key.slice(o.blockId.length + 1)) }));
  const minuty = pozycje.reduce((s, p) => s + p.o.durationMin, 0);
  const zrobione = pozycje.reduce((s, p) => s + p.postep.done, 0);
  const wszystkie = pozycje.reduce((s, p) => s + p.postep.total, 0);
  const liczby = [
    ["Bloki", String(pozycje.length)],
    ["Godziny", (minuty / 60).toLocaleString("pl-PL", { maximumFractionDigits: 1 })],
    ["Zadania", `${zrobione}/${wszystkie}`],
  ];

  return (
    <aside
      aria-label="Plan dnia"
      className="box-border flex w-[300px] flex-none flex-col gap-4 overflow-y-auto border-l border-border p-4"
    >
      <h2 className="m-0 text-base font-semibold">Plan dnia</h2>
      <div className="grid grid-cols-3 gap-2">
        {liczby.map(([nazwa, wartosc]) => (
          <Card key={nazwa} data-testid={`liczba-${nazwa}`} className="px-3 py-2.5">
            <div className="text-xs text-muted-foreground">{nazwa}</div>
            <b className="text-lg font-semibold tabular-nums">{wartosc}</b>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        {pozycje.map(({ o, postep }) => (
          <button
            key={o.key}
            type="button"
            onClick={(e) => onBlockClick(o.key, e.currentTarget)}
            className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-sm text-foreground outline-none hover:bg-muted focus-visible:shadow-focus"
          >
            <span
              aria-hidden="true"
              className="size-2 flex-none rounded-full"
              style={{ background: categories.find((k) => k.id === o.categoryId)?.color ?? "#a3a3a3" }}
            />
            <span className="flex-none text-xs text-muted-foreground tabular-nums">
              {formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{o.title}</span>
            {postep.total > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{`${postep.done}/${postep.total}`}</span>
            )}
          </button>
        ))}
        {pozycje.length === 0 && (
          <p className="m-0 px-2.5 py-2 text-xs text-muted-foreground">Brak bloków. Kliknij w siatkę, żeby dodać pierwszy.</p>
        )}
      </div>
    </aside>
  );
}
