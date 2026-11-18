"use client";

// Dymek bloku wg Calendar.dc.html: kategoria, tytuł, termin, zadania wystąpienia, notatka i akcje.
// BlockDetails to sama treść (użyje jej też arkusz na telefonie), BlockPopover dokłada
// Radix Popover zakotwiczony przy klikniętym bloku.
import { useEffect, useRef, useState } from "react";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  addTask,
  deleteTask,
  toggleTask,
  unpinTask,
} from "@/features/tasks/actions";
import {
  occurrenceProgress,
  unpinTask as unpinTaskFields,
  type TaskRow,
} from "@/features/tasks/model";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import type { CategoryRow } from "./load-calendar";
import type { Occurrence } from "./occurrences";
import { recurrenceBadge } from "./recurrence-text";
import type { CalendarChange } from "./use-calendar-store";
import { weekdayOf } from "./view-range";

const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const PREFIKS_TYMCZASOWY = "tmp-";

type ApplyOptimistic = (
  zmiana: CalendarChange,
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
  const [otwarteMenu, setOtwarteMenu] = useState<string | null>(null);
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

  // Odpięte zadanie zostaje z terminem, ale znika z bloku (staje się samodzielne)
  function odepnij(zadanie: TaskRow) {
    setOtwarteMenu(null);
    void applyOptimistic(
      (d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === zadanie.id ? { ...t, ...unpinTaskFields(zadanie) } : t,
        ),
      }),
      () => unpinTask({ taskId: zadanie.id }),
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

  return (
    <div className="flex flex-col gap-3.5 text-sm">
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[.06em] text-[#666666] uppercase">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: category?.color ?? "#a3a3a3" }}
            />
            {category?.name ?? "Bez kategorii"}
          </span>
          <span className="text-base leading-[1.3] font-semibold break-words">
            {o.title}
          </span>
          <span className="font-mono text-xs text-[#666666]">{kiedy}</span>
        </div>
        <button
          type="button"
          aria-label="Zamknij"
          onClick={onClose}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] size-7 flex-none cursor-pointer rounded-md border border-[#e0e0e0] bg-white text-[#666666] max-[799px]:size-11"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase">
            Zadania
          </span>
          <span className="font-mono text-xs text-[#666666]">{`${done} z ${total}`}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Postęp zadań"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={procent}
          className="h-1 rounded-sm bg-[#f0f0f0]"
        >
          <div
            className="h-1 rounded-sm bg-[#15803d]"
            style={{ width: `${procent}%` }}
          />
        </div>
        {total === 0 && (
          <span className="py-1.5 text-[13px] text-[#6b6b6b]">
            Brak zadań w tym bloku.
          </span>
        )}
        {zadania.map((t) => {
          const tymczasowe = t.id.startsWith(PREFIKS_TYMCZASOWY);
          return (
            <div
              key={t.id}
              className="flex min-h-8 items-center gap-1 max-[799px]:min-h-11"
            >
              <label
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[13px] ${
                  t.done ? "text-[#6b6b6b] line-through" : "text-[#171717]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  disabled={tymczasowe}
                  onChange={() => przelacz(t)}
                  className="m-0 size-4 flex-none accent-[#15803d]"
                />
                <span className="min-w-0 break-words">{t.title}</span>
              </label>
              {otwarteMenu === t.id && (
                <button
                  type="button"
                  aria-label={`Odepnij zadanie ${t.title}`}
                  onClick={() => odepnij(t)}
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] cursor-pointer rounded-md border border-[#e0e0e0] bg-white px-2 py-0.5 text-xs text-[#404040] max-[799px]:min-h-11"
                >
                  Odepnij
                </button>
              )}
              <button
                type="button"
                aria-label={`Opcje zadania ${t.title}`}
                aria-expanded={otwarteMenu === t.id}
                disabled={tymczasowe}
                onClick={() =>
                  setOtwarteMenu(otwarteMenu === t.id ? null : t.id)
                }
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] flex size-6 flex-none cursor-pointer items-center justify-center rounded-md text-[#6b6b6b] hover:bg-[#f5f5f5] max-[799px]:size-11"
              >
                ⋯
              </button>
              <button
                type="button"
                aria-label={`Usuń zadanie ${t.title}`}
                disabled={tymczasowe}
                onClick={() => usun(t)}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] flex size-6 flex-none cursor-pointer items-center justify-center rounded-md text-[#6b6b6b] hover:bg-[#f5f5f5] hover:text-[#b91c1c] max-[799px]:size-11"
              >
                ×
              </button>
            </div>
          );
        })}
        <label className="flex min-h-8 items-center gap-2.5 border-t border-dashed border-[#e0e0e0] pt-1.5 text-[#6b6b6b] max-[799px]:min-h-11">
          <span aria-hidden="true" className="font-mono">
            +
          </span>
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
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#171717] outline-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
          />
        </label>
      </div>

      {o.note && (
        <div className="border-t border-[#f0f0f0] pt-2.5">
          <div className="font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase">
            Notatka
          </div>
          <p className="mt-1.5 text-[13px] leading-normal break-words whitespace-pre-wrap text-[#404040]">
            {o.note}
          </p>
        </div>
      )}

      <div className="flex gap-2 border-t border-[#f0f0f0] pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] cursor-pointer rounded-md border border-[#e0e0e0] bg-white px-3 py-1.5 max-[799px]:min-h-11"
        >
          Edytuj
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] cursor-pointer border-0 bg-transparent px-2 py-1.5 font-medium text-[#b91c1c] max-[799px]:min-h-11"
        >
          Usuń
        </button>
        {o.recurrence && (
          <span className="ml-auto self-center font-mono text-[11px] text-[#6b6b6b]">
            {recurrenceBadge(o.recurrence)}
          </span>
        )}
      </div>
    </div>
  );
}

export function BlockPopover({
  onClose,
  align = "start",
  ...reszta
}: Wlasciwosci & Wyrownanie & { onClose: () => void }) {
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
        side="right"
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
        className="max-h-(--radix-popover-content-available-height) w-[340px] overflow-y-auto rounded-[10px] border-[#e0e0e0] p-4 shadow-[0_12px_32px_rgba(0,0,0,.12),0_2px_6px_rgba(0,0,0,.06)]"
      >
        <BlockDetails {...reszta} onClose={onClose} />
      </PopoverContent>
    </Popover>
  );
}
