"use client";

// Usuwanie bloku: jednorazowy — małe potwierdzenie „Usunąć blok?”, cykliczny — okno zakresu.
import { useState } from "react";

import { Button, FormDialog } from "@/components/controls";
import { formatClockTime } from "@/lib/time/timezones";
import { changeOccurrence } from "./actions";
import type { Occurrence } from "./occurrences";
import { recurrenceBadge } from "./recurrence-text";
import { ScopeDialog } from "./scope-dialog";
import type { Scope } from "./scope";

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

  // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
  const dataOryginalna = o.key.slice(o.blockId.length + 1);

  async function usun(zakres: Scope) {
    setPending(true);
    setBlad("");
    const wynik = await changeOccurrence({
      blockId: o.blockId,
      date: dataOryginalna,
      scope: zakres,
      delete: true,
    });
    setPending(false);
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

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => !otwarte && onCancel()}
      title="Usunąć blok?"
      description={`„${o.title}”`}
      footer={
        <>
          {blad && (
            <p role="alert" className="mr-auto text-xs text-[#b91c1c]">
              {blad}
            </p>
          )}
          <Button onClick={onCancel}>Anuluj</Button>
          <Button variant="destructive" disabled={pending} onClick={() => usun("all")}>
            Usuń
          </Button>
        </>
      }
    >
      <p className="m-0 text-[13px] text-[#666666] min-[800px]:hidden">{`„${o.title}”`}</p>
    </FormDialog>
  );
}
