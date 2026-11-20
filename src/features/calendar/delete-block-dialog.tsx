"use client";

// Usuwanie bloku: jednorazowy — zwarte potwierdzenie „Usunąć blok?” (DeleteBlockDialog.dc.html),
// cykliczny — okno zakresu.
import { useRef, useState } from "react";
import { Dialog } from "radix-ui";

import { Button } from "@/components/controls";
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
    <Dialog.Root
      open
      // W trakcie usuwania Esc i klik w tło nie zamykają okna
      onOpenChange={(otwarte) => !otwarte && !pending && onCancel()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 max-[799px]:bg-black/40" />
        <Dialog.Content
          role="alertdialog"
          className="fixed z-50 flex flex-col gap-4 bg-white text-sm text-foreground outline-none min-[800px]:top-1/2 min-[800px]:left-1/2 min-[800px]:w-[min(360px,calc(100%-32px))] min-[800px]:-translate-x-1/2 min-[800px]:-translate-y-1/2 min-[800px]:rounded-xl min-[800px]:border min-[800px]:border-input min-[800px]:px-5 min-[800px]:pt-[18px] min-[800px]:pb-4 min-[800px]:shadow-[0_16px_48px_rgba(0,0,0,.16)] max-[799px]:inset-x-0 max-[799px]:bottom-0 max-[799px]:rounded-t-[18px] max-[799px]:px-4 max-[799px]:pt-2 max-[799px]:pb-7 max-[799px]:shadow-[0_-8px_30px_rgba(0,0,0,.12)]"
        >
          {/* Uchwyt arkusza — tylko na telefonie */}
          <div
            aria-hidden="true"
            className="mx-auto h-[5px] w-9 flex-none rounded-[3px] bg-border-strong min-[800px]:hidden"
          />
          <div>
            <Dialog.Title className="m-0 text-base font-semibold">
              Usunąć blok?
            </Dialog.Title>
            <Dialog.Description className="m-0 mt-1 text-[13px] text-muted-foreground">
              {opis}
            </Dialog.Description>
          </div>
          {blad && (
            <p role="alert" className="m-0 text-xs text-destructive-foreground">
              {blad}
            </p>
          )}
          {/* Web: przyciski od razu pod opisem, bez szarego paska; telefon: dwa pełne przyciski */}
          <div className="flex justify-end gap-2 max-[799px]:flex-col-reverse">
            <Button
              size="sm"
              className="max-[799px]:h-12"
              disabled={pending}
              onClick={onCancel}
            >
              Anuluj
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="max-[799px]:h-12"
              disabled={pending}
              onClick={() => usun("all")}
            >
              Usuń
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
