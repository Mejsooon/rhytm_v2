"use client";

// Usuwanie bloku: jednorazowy — potwierdzenie „Usunąć blok?” (DeleteBlockDialog.dc.html, na webie w stylu .dlg z coss.css),
// cykliczny — okno zakresu.
import { useRef, useState } from "react";

import { ConfirmDialog } from "@/components/controls";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import { changeOccurrence } from "./actions";
import type { Occurrence } from "./occurrences";
import { recurrenceBadge } from "./recurrence-text";
import { ScopeDialog } from "./scope-dialog";
import type { Scope } from "./scope";
import { weekdayOf } from "./view-range";

const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];

export function DeleteBlockDialog({
  occurrence: o,
  clock,
  onDeleted,
  onCancel,
}: {
  occurrence: Occurrence;
  clock: "24" | "12";
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego usunięcia (szybkie dwa kliknięcia)
  const usuwa = useRef(false);

  // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
  const dataOryginalna = o.key.slice(o.blockId.length + 1);

  async function usun(zakres: Scope) {
    if (usuwa.current) return;
    usuwa.current = true;
    setPending(true);
    setBlad("");
    let wynik: ActionResult;
    try {
      wynik = await changeOccurrence({
        blockId: o.blockId,
        date: dataOryginalna,
        scope: zakres,
        delete: true,
      });
    } finally {
      usuwa.current = false;
      setPending(false);
    }
    if (!wynik.ok) {
      setBlad(wynik.message);
      return;
    }
    onDeleted();
  }

  if (o.recurrence) {
    const koniec = o.startMin + o.durationMin;
    return (
      <ScopeDialog
        intent="delete"
        subtitle={`„${o.title}” · ${recurrenceBadge(o.recurrence).slice(2)}`}
        date={dataOryginalna}
        timeLabel={`${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`}
        pending={pending}
        error={blad}
        onPick={usun}
        onCancel={onCancel}
      />
    );
  }

  // Opis jak w makiecie: „„Bieg 10 km” · wt 17.11 · 16:00–17:00” (dzień, w którym blok widać)
  const czas = Math.min(o.durationMin, 1440 - o.startMin);
  const koniec = o.startMin + czas;
  const godziny = `${formatClockTime(Math.floor(o.startMin / 60), o.startMin % 60, clock)}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`;
  const [, miesiac, dzien] = o.date.split("-").map(Number);
  const opis = `„${o.title}” · ${DNI_KROTKO[weekdayOf(o.date)]} ${dzien}.${String(miesiac).padStart(2, "0")} · ${godziny}`;

  return (
    <ConfirmDialog
      open
      onOpenChange={(otwarte) => !otwarte && onCancel()}
      title="Usunąć blok?"
      description={opis}
      error={blad}
      confirmLabel="Usuń"
      pending={pending}
      onConfirm={() => usun("all")}
    >
      Zadania bloku, jeśli są, zostaną usunięte razem z nim.
    </ConfirmDialog>
  );
}
