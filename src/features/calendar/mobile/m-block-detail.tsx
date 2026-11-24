"use client";

// Szczegóły bloku na telefonie wg CMBlockDetail.dc.html: arkusz od dołu z jednym ✕, plakietka kategorii,
// tytuł, dzień · godziny · czas, reguła powtarzania, karta zadań z polem „Dodaj zadanie…”, notatka
// i stopka „Usuń” · „Edytuj”. Zadania zmieniają się optymistycznie, tak samo jak w dymku na webie.
import { useRef, useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button, Card, Checkbox, FormDialog } from "@/components/controls";
import { addTask, toggleTask } from "@/features/tasks/actions";
import { occurrenceProgress, type TaskRow } from "@/features/tasks/model";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import type { TasksChange } from "../block-popover";
import type { CategoryRow } from "../load-calendar";
import type { Occurrence } from "../occurrences";
import { describeRecurrence } from "../recurrence-text";
import { weekdayOf } from "../view-range";
import { DNI_SKROT, KOLOR_BRAK } from "./pl";

const PREFIKS_TYMCZASOWY = "tmp-";

export function MBlockDetail({
  occurrence: o,
  tasks,
  category,
  clock,
  applyOptimistic,
  onEdit,
  onDelete,
  onClose,
}: {
  occurrence: Occurrence;
  // Wszystkie zadania kalendarza (z optymistycznymi zmianami); arkusz wybiera swoje
  tasks: TaskRow[];
  category?: CategoryRow;
  clock: "24" | "12";
  applyOptimistic: (
    zmiana: TasksChange,
    akcja: () => Promise<ActionResult>,
  ) => Promise<boolean>;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
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

  const kolor = category?.color ?? KOLOR_BRAK;
  const czas = Math.min(o.durationMin, 1440 - o.startMin);
  const koniec = o.startMin + czas;
  const godziny = `${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`;
  // Czas trwania: „1 h 30 min”, „1 h”, „45 min”
  const pelneGodziny = Math.floor(czas / 60);
  const minuty = czas % 60;
  const trwanie = [
    pelneGodziny > 0 ? `${pelneGodziny} h` : null,
    minuty > 0 ? `${minuty} min` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const [, miesiac, dzien] = o.date.split("-").map(Number);
  const kiedy = `${DNI_SKROT[weekdayOf(o.date)]} ${dzien}.${String(miesiac).padStart(2, "0")} · ${godziny} · ${trwanie}`;
  // Reguła powtarzania bez dopisku o pustych listach zadań (ten jest w arkuszu edycji)
  const regula = o.recurrence
    ? describeRecurrence(o.recurrence, o.date).split(". ")[0]
    : null;

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
    <FormDialog
      open
      onOpenChange={(otwarte) => !otwarte && onClose()}
      title="Szczegóły bloku"
      // Makieta nie ma nagłówka z tytułem: nazwa arkusza zostaje dla czytników, ✕ stoi w prawym rogu
      titleClassName="max-[799px]:sr-only"
      footerClassName="max-[799px]:grid max-[799px]:grid-cols-2 max-[799px]:gap-2.5 max-[799px]:border-t-0 max-[799px]:bg-transparent max-[799px]:px-5 max-[799px]:pt-0 max-[799px]:pb-[max(20px,env(safe-area-inset-bottom))]"
      footer={
        <>
          <Button variant="destructive-outline" onClick={onDelete}>
            Usuń
          </Button>
          <Button onClick={onEdit}>Edytuj</Button>
        </>
      }
    >
      {/* Plakietka kategorii: tło, ramka i kropka z koloru kategorii (to dane) */}
      <span
        className="inline-flex h-[22px] items-center gap-1 self-start rounded-md border px-[7px] text-[13px] font-medium whitespace-nowrap text-foreground"
        style={{ background: `${kolor}12`, borderColor: `${kolor}4d` }}
      >
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ background: kolor }}
        />
        {category?.name ?? "Bez kategorii"}
      </span>

      <div>
        <h2 className="m-0 text-[22px] leading-[1.3] font-semibold break-words">
          {o.title}
        </h2>
        <p className="mt-1 mb-0 text-sm text-muted-foreground tabular-nums">
          {kiedy}
        </p>
        {regula && (
          <p className="mt-0.5 mb-0 text-xs text-muted-foreground">{regula}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {`Zadania · ${done} z ${total}`}
        </span>
        <Card>
          {zadania.map((t) => (
            // Cały wiersz jest celem dotyku: klik w etykietę przełącza pole
            <label key={t.id} className="m-row cursor-pointer">
              <Checkbox
                checked={t.done}
                ariaLabel={t.title}
                disabled={t.id.startsWith(PREFIKS_TYMCZASOWY)}
                onChange={(wykonane) =>
                  void applyOptimistic(
                    (d) => ({
                      ...d,
                      tasks: d.tasks.map((z) =>
                        z.id === t.id ? { ...z, done: wykonane } : z,
                      ),
                    }),
                    () => toggleTask({ id: t.id, done: wykonane }),
                  )
                }
              />
              <span
                className={`min-w-0 flex-1 break-words ${t.done ? "text-muted-foreground line-through" : ""}`}
              >
                {t.title}
              </span>
            </label>
          ))}
          <div className="m-row gap-2 pr-2">
            <input
              type="text"
              value={nowy}
              maxLength={200}
              placeholder="Dodaj zadanie…"
              aria-label="Nowe zadanie"
              onChange={(e) => setNowy(e.target.value)}
              onKeyDown={(e) => {
                // Enter zatwierdzający wybór znaku w IME nie dodaje zadania
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  dodaj();
                }
              }}
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-faint-foreground"
            />
            <Button
              variant="ghost"
              icon
              aria-label="Dodaj zadanie"
              onClick={dodaj}
            >
              <PlusIcon aria-hidden="true" className="size-[18px]" />
            </Button>
          </div>
        </Card>
      </div>

      {o.note && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Notatka
          </span>
          <p className="m-0 break-words whitespace-pre-wrap">{o.note}</p>
        </div>
      )}
    </FormDialog>
  );
}
