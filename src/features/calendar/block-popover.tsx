"use client";

// Dymek bloku wg Calendar.dc.html: kategoria, tytuł, termin, zadania wystąpienia, notatka i akcje.
// BlockDetails to sama treść (użyje jej też arkusz na telefonie), BlockPopover dokłada
// Radix Popover zakotwiczony przy klikniętym bloku.
import { useEffect, useRef, useState } from "react";
import { CheckIcon, Plus, X } from "lucide-react";

import { Button, Progress, StatusBadge } from "@/components/controls";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { addTask, deleteTask, toggleTask } from "@/features/tasks/actions";
import { occurrenceProgress, type TaskRow } from "@/features/tasks/model";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import type { CategoryRow } from "./load-calendar";
import type { Occurrence } from "./occurrences";
import { recurrenceBadge } from "./recurrence-text";
import { weekdayOf } from "./view-range";

const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const PREFIKS_TYMCZASOWY = "tmp-";

// Dymek zmienia tylko zadania, więc działa z każdym magazynem, który je ma
// (kalendarz: CalendarData, Dziś: TodayData)
export type TasksChange = <D extends { tasks: TaskRow[] }>(data: D) => D;

type ApplyOptimistic = (
  zmiana: TasksChange,
  akcja: () => Promise<ActionResult>,
) => Promise<boolean>;

type Wlasciwosci = {
  occurrence: Occurrence;
  // Wszystkie zadania kalendarza (z optymistycznymi zmianami); dymek wybiera swoje
  tasks: TaskRow[];
  category?: CategoryRow;
  clock: "24" | "12";
  applyOptimistic: ApplyOptimistic;
  onEdit: () => void;
  onDelete: () => void;
};
// Wyrównanie dymku do kotwicy: "end" (dół dymku przy dole kotwicy) otwiera go w górę
type Wyrownanie = { align?: "start" | "end" };

export function BlockDetails({
  occurrence: o,
  tasks,
  category,
  clock,
  applyOptimistic,
  onEdit,
  onDelete,
  onClose,
}: Wlasciwosci & { onClose: () => void }) {
  const [nowy, setNowy] = useState("");
  const licznikTymczasowych = useRef(0);

  // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
  const dataOryginalna = o.key.slice(o.blockId.length + 1);
  const zadania = tasks
    .filter(
      (t) => t.block_id === o.blockId && t.occurrence_date === dataOryginalna,
    )
    .sort((a, b) => a.position - b.position);
  const { done, total } = occurrenceProgress(tasks, o.blockId, dataOryginalna);
  const procent = total > 0 ? Math.round((done / total) * 100) : 0;

  const czas = Math.min(o.durationMin, 1440 - o.startMin);
  const koniec = o.startMin + czas;
  const godziny = `${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`;
  const [, miesiac, dzien] = o.date.split("-").map(Number);
  const kiedy = `${DNI_KROTKO[weekdayOf(o.date)]} ${dzien}.${String(miesiac).padStart(2, "0")} · ${godziny}`;

  function przelacz(zadanie: TaskRow) {
    const wykonane = !zadanie.done;
    void applyOptimistic(
      (d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === zadanie.id ? { ...t, done: wykonane } : t,
        ),
      }),
      () => toggleTask({ id: zadanie.id, done: wykonane }),
    );
  }

  function usun(zadanie: TaskRow) {
    void applyOptimistic(
      (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== zadanie.id) }),
      () => deleteTask({ id: zadanie.id }),
    );
  }

  function dodaj() {
    const tytul = nowy.trim();
    if (tytul === "") return;
    setNowy("");
    licznikTymczasowych.current += 1;
    const tymczasowe: TaskRow = {
      id: `${PREFIKS_TYMCZASOWY}${o.key}-${licznikTymczasowych.current}`,
      user_id: "",
      title: tytul,
      done: false,
      done_at: null,
      due_date: o.date,
      block_id: o.blockId,
      occurrence_date: dataOryginalna,
      position: Number.MAX_SAFE_INTEGER,
      created_at: null,
    };
    void applyOptimistic(
      (d) => ({ ...d, tasks: [...d.tasks, tymczasowe] }),
      () => addTask({ blockId: o.blockId, date: dataOryginalna, title: tytul }),
    );
  }

  // Dymek na webie (.pop z CToday): sekcje mają własny padding 16 px, stopka na szarym tle.
  // Na telefonie ta sama treść siedzi w arkuszu FormDialog, który ma własny padding — tam bez niego.
  return (
    <div className="flex flex-col gap-3.5 text-sm">
      <div className="flex items-start gap-2.5 min-[800px]:px-4 min-[800px]:pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 flex-none rounded-full"
              style={{ background: category?.color ?? "#a3a3a3" }}
            />
            {category?.name ?? "Bez kategorii"}
          </span>
          <span className="text-base leading-[1.3] font-semibold break-words">
            {o.title}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{kiedy}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon
          aria-label="Zamknij"
          onClick={onClose}
          className="max-[799px]:hidden"
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col gap-2 min-[800px]:px-4">
        <div className="flex items-center justify-between">
          {/* .lbl */}
          <span className="text-xs font-medium text-muted-foreground">Zadania</span>
          <span className="text-xs text-muted-foreground tabular-nums">{`${done} z ${total}`}</span>
        </div>
        <Progress value={procent} max={100} ariaLabel="Postęp zadań" />
        {total === 0 && (
          <span className="py-1.5 text-xs text-muted-foreground">
            Brak zadań w tym bloku.
          </span>
        )}
        {zadania.map((t) => {
          const tymczasowe = t.id.startsWith(PREFIKS_TYMCZASOWY);
          return (
            <div
              key={t.id}
              className="group flex min-h-[30px] items-center gap-1 max-[799px]:min-h-11"
            >
              <label
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm ${
                  t.done ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {/* Natywne pole wyglądające jak checkbox z coss.css (16 px, zaznaczone primary) */}
                <span className="relative flex size-4 flex-none">
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={tymczasowe}
                    onChange={() => przelacz(t)}
                    className="peer m-0 size-4 flex-none cursor-pointer appearance-none rounded-[4px] border border-input bg-white shadow-xs outline-none checked:border-primary checked:bg-primary focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-[.64]"
                  />
                  <CheckIcon
                    aria-hidden="true"
                    strokeWidth={3}
                    className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-primary-foreground peer-checked:block"
                  />
                </span>
                <span className="min-w-0 break-words">{t.title}</span>
              </label>
              {/* × na webie z myszą pojawia się po najechaniu na wiersz lub przy fokusie w nim;
                  bez hovera (tablet dotykowy ≥ 800 px, telefon) jest widoczny stale */}
              <Button
                variant="ghost"
                size="xs"
                icon
                aria-label={`Usuń zadanie ${t.title}`}
                disabled={tymczasowe}
                onClick={() => usun(t)}
                className="text-muted-foreground hover:text-destructive-foreground max-[799px]:size-11 min-[800px]:[@media(hover:hover)]:opacity-0 min-[800px]:group-hover:opacity-100 min-[800px]:group-focus-within:opacity-100 focus-visible:opacity-100"
              >
                <X size={14} aria-hidden="true" />
              </Button>
            </div>
          );
        })}
        {/* .igroup 30 px z ikoną + */}
        <label className="mt-0.5 flex h-[30px] items-center gap-2 rounded-md border border-input bg-white bg-clip-padding px-[11px] text-muted-foreground shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo max-[799px]:h-11">
          <Plus size={14} aria-hidden="true" className="flex-none" />
          <input
            type="text"
            aria-label="Nowe zadanie"
            placeholder="Dodaj zadanie"
            value={nowy}
            onChange={(e) => setNowy(e.target.value)}
            onKeyDown={(e) => {
              // Enter zatwierdzający wybór znaku w IME nie dodaje zadania
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                dodaj();
              }
            }}
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-foreground outline-0 placeholder:text-faint-foreground"
          />
        </label>
      </div>

      {o.note && (
        <div className="max-[799px]:border-t max-[799px]:border-border max-[799px]:pt-2.5 min-[800px]:px-4">
          <div className="text-xs font-medium text-muted-foreground">Notatka</div>
          <p className="mt-1 mb-0 text-sm leading-normal break-words whitespace-pre-wrap text-soft-foreground">
            {o.note}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border pt-3 min-[800px]:rounded-b-[11px] min-[800px]:bg-black/[.025] min-[800px]:px-4 min-[800px]:pb-3">
        <Button size="sm" onClick={onEdit} className="max-[799px]:h-11">
          Edytuj
        </Button>
        <Button
          size="sm"
          variant="destructive-outline"
          onClick={onDelete}
          className="max-[799px]:h-11"
        >
          Usuń
        </Button>
        {o.recurrence && (
          <StatusBadge tone="gray" className="ml-auto">
            {recurrenceBadge(o.recurrence)}
          </StatusBadge>
        )}
      </div>
    </div>
  );
}

export function BlockPopover({
  onClose,
  align = "start",
  side = "right",
  ...reszta
}: Wlasciwosci &
  Wyrownanie & {
    onClose: () => void;
    // Strona dymka względem bloku; Dziś ma bloki na całą szerokość, więc otwiera pod/nad blokiem
    side?: "right" | "bottom";
  }) {
  // Kotwica to przycisk bloku w siatce, szukany po kluczu wystąpienia (element mógł zostać
  // podmieniony przy odświeżeniu); bez niego dymek się zamyka
  const kotwica = document.querySelector<HTMLElement>(
    `[data-occurrence-key="${reszta.occurrence.key}"]`,
  );
  const anchor = kotwica?.isConnected ? kotwica : null;
  useEffect(() => {
    if (!anchor) onClose();
  });
  if (!anchor) return null;

  return (
    <Popover open onOpenChange={(otwarty) => !otwarty && onClose()}>
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent
        role="dialog"
        aria-label="Szczegóły bloku"
        // Najpierw w prawo od bloku; przy prawej krawędzi Radix przerzuca w lewo,
        // a przy dolnej przesuwa dymek w górę (collisionPadding)
        side={side}
        align={align}
        sideOffset={10}
        collisionPadding={12}
        onInteractOutside={(e) => {
          // Klik w ten sam blok zamyka dymek (przełącza go onBlockClick), nie otwiera od nowa
          if (e.target instanceof Node && anchor.contains(e.target))
            e.preventDefault();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (anchor.isConnected) anchor.focus();
        }}
        // .pop: promień 12 px, ramka border, cień shadow-lg, bez paddingu (sekcje mają własny)
        className="max-h-(--radix-popover-content-available-height) w-[340px] overflow-y-auto rounded-lg border-border p-0 shadow-lg"
      >
        <BlockDetails {...reszta} onClose={onClose} />
      </PopoverContent>
    </Popover>
  );
}
