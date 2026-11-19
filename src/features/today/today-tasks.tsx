"use client";

// „Zadania na dziś” pod planem dnia (spec 6.5, bez makiety web — wygląd jak lista zadań
// w dymku bloku): samodzielne zadania na dziś + zaległe niezrobione (na górze, z „zaległe”),
// odhaczanie, „+ Zadanie” oraz zwijana sekcja „Bez daty” z własnym „+ Zadanie”.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { IsoDate } from "@/components/controls/calendar-math";
import { createStandaloneTask, toggleTask } from "@/features/tasks/actions";
import { groupStandaloneTasks, type TaskRow } from "@/features/tasks/model";
import type { ActionResult } from "@/lib/action-result";
import type { TodayChange } from "./use-today-store";

const PREFIKS_TYMCZASOWY = "tmp-";

export function TodayTasks({
  tasks,
  today,
  applyOptimistic,
}: {
  tasks: TaskRow[];
  today: IsoDate;
  applyOptimistic: (
    zmiana: TodayChange,
    akcja: () => Promise<ActionResult>,
  ) => Promise<boolean>;
}) {
  const router = useRouter();
  // Pole „+ Zadanie” otwarte w liście dnia („dzis”) albo w „Bez daty” („bez”)
  const [pole, setPole] = useState<"dzis" | "bez" | null>(null);
  const [tytul, setTytul] = useState("");
  const [bezDatyOtwarte, setBezDatyOtwarte] = useState(false);
  const licznikTymczasowych = useRef(0);

  const grupy = groupStandaloneTasks(tasks, today);
  const wgPozycji = (a: TaskRow, b: TaskRow) => a.position - b.position;
  // Zaległe na górze (najstarsze pierwsze), potem dzisiejsze
  const zalegle = [...grupy.overdue].sort((a, b) =>
    a.due_date === b.due_date
      ? a.position - b.position
      : (a.due_date ?? "") < (b.due_date ?? "")
        ? -1
        : 1,
  );
  const dzisiejsze = [...grupy.today].sort(wgPozycji);
  const bezDaty = [...grupy.noDate].sort(wgPozycji);
  const lista = [...zalegle, ...dzisiejsze];
  const zrobione = lista.filter((t) => t.done).length;

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

  function dodaj(termin: IsoDate | null) {
    const nowy = tytul.trim();
    if (nowy === "") return;
    setTytul("");
    licznikTymczasowych.current += 1;
    const tymczasowe: TaskRow = {
      id: `${PREFIKS_TYMCZASOWY}${licznikTymczasowych.current}`,
      user_id: "",
      title: nowy,
      done: false,
      done_at: null,
      due_date: termin,
      block_id: null,
      occurrence_date: null,
      position: Number.MAX_SAFE_INTEGER,
      created_at: null,
    };
    void applyOptimistic(
      (d) => ({ ...d, tasks: [...d.tasks, tymczasowe] }),
      () => createStandaloneTask({ title: nowy, dueDate: termin }),
    ).then((udane) => {
      // Akcje zadań odświeżają tylko /kalendarz; Dziś pobiera dane sam (prawdziwe id)
      if (udane) router.refresh();
    });
  }

  const wiersz = (t: TaskRow) => {
    const tymczasowe = t.id.startsWith(PREFIKS_TYMCZASOWY);
    const zaleglaData = t.due_date !== null && t.due_date < today;
    return (
      <label
        key={t.id}
        className={`flex min-h-8 cursor-pointer items-center gap-2.5 text-[13px] max-[799px]:min-h-11 ${
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
        {zaleglaData && t.due_date && (
          <>
            <span className="rounded bg-[#fef2f2] px-1.5 py-px font-mono text-[10px] text-[#b91c1c]">
              zaległe
            </span>
            <span className="font-mono text-[11px] text-[#6b6b6b]">
              {`${t.due_date.slice(8, 10)}.${t.due_date.slice(5, 7)}`}
            </span>
          </>
        )}
      </label>
    );
  };

  // „+ Zadanie”: przycisk, a po kliknięciu pole (Enter dodaje, Esc anuluje)
  const dodawanie = (gdzie: "dzis" | "bez", termin: IsoDate | null) =>
    pole === gdzie ? (
      <label className="flex min-h-8 items-center gap-2.5 border-t border-dashed border-[#e0e0e0] pt-1.5 text-[#6b6b6b] max-[799px]:min-h-11">
        <span aria-hidden="true" className="font-mono">
          +
        </span>
        <input
          type="text"
          aria-label="Nowe zadanie"
          placeholder="Dodaj zadanie"
          autoFocus
          value={tytul}
          onChange={(e) => setTytul(e.target.value)}
          onKeyDown={(e) => {
            // Enter zatwierdzający wybór znaku w IME nie dodaje zadania
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              dodaj(termin);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setTytul("");
              setPole(null);
            }
          }}
          className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#171717] outline-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
        />
      </label>
    ) : (
      <button
        type="button"
        onClick={() => {
          setTytul("");
          setPole(gdzie);
        }}
        className="flex min-h-8 cursor-pointer items-center self-start rounded-md border-0 bg-transparent px-0 text-[13px] text-[#6b6b6b] hover:text-[#171717] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] max-[799px]:min-h-11"
      >
        + Zadanie
      </button>
    );

  return (
    <section
      aria-labelledby="zadania-na-dzis"
      className="flex flex-col gap-2 rounded-lg border border-[#eaeaea] p-4 text-sm"
    >
      <div className="flex items-center justify-between">
        <h2 id="zadania-na-dzis" className="m-0 text-[15px] font-semibold">
          Zadania na dziś
        </h2>
        {lista.length > 0 && (
          <span className="font-mono text-xs text-[#666666]">{`${zrobione} z ${lista.length}`}</span>
        )}
      </div>
      {lista.length === 0 && (
        <span className="py-1.5 text-[13px] text-[#6b6b6b]">
          Brak zadań na dziś.
        </span>
      )}
      {lista.map(wiersz)}
      {dodawanie("dzis", today)}

      <div className="mt-1 flex flex-col gap-2 border-t border-[#f0f0f0] pt-2.5">
        <button
          type="button"
          aria-expanded={bezDatyOtwarte}
          aria-controls="zadania-bez-daty"
          onClick={() => setBezDatyOtwarte((o) => !o)}
          className="flex min-h-8 cursor-pointer items-center gap-2 self-start border-0 bg-transparent px-0 font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] max-[799px]:min-h-11"
        >
          <span aria-hidden="true">{bezDatyOtwarte ? "▾" : "▸"}</span>
          Bez daty
          <span className="rounded bg-[#f5f5f5] px-1.5 py-px text-[#404040]">
            {bezDaty.length}
          </span>
        </button>
        {bezDatyOtwarte && (
          <div
            id="zadania-bez-daty"
            role="group"
            aria-label="Bez daty"
            className="flex flex-col gap-2"
          >
            {bezDaty.map(wiersz)}
            {dodawanie("bez", null)}
          </div>
        )}
      </div>
    </section>
  );
}
