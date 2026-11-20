"use client";

// Zwarte potwierdzenie „Usunąć trening?” (wzór: DeleteBlockDialog). Sesja jest usuwana (kaskada),
// a wystąpienie szablonu zapisuje pominięcie (template_skips). Okno czeka na serwer.
import { useRef, useState } from "react";
import { Dialog } from "radix-ui";

import { Button } from "@/components/controls";
import { weekdayOf } from "@/features/calendar/view-range";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import { deleteSession, skipTemplateOccurrence } from "./actions";
import type { SportItem } from "./model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export function DeleteSessionDialog({
  item,
  clock,
  onDeleted,
  onCancel,
}: {
  item: SportItem;
  clock: "24" | "12";
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego usunięcia (szybkie dwa kliknięcia)
  const usuwa = useRef(false);

  async function usun() {
    if (usuwa.current) return;
    usuwa.current = true;
    setPending(true);
    setBlad("");
    let wynik: ActionResult;
    try {
      wynik = item.sessionId
        ? await deleteSession(item.sessionId)
        : await skipTemplateOccurrence(item.templateId ?? "", item.date);
    } catch {
      wynik = { ok: false, message: BLAD_ZAPISU };
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

  // „„Długi bieg” · nd 15.11 · 09:00–10:30”
  const koniec = Math.min(item.startMin + item.durationMin, 1440);
  const godzina = (min: number) =>
    formatClockTime(Math.floor(min / 60), min % 60, clock);
  const [, mm, dd] = item.date.split("-");
  const opis = `„${item.title}” · ${DNI[weekdayOf(item.date)]} ${dd}.${mm} · ${godzina(item.startMin)}–${godzina(koniec)}`;

  return (
    <Dialog.Root
      open
      // W trakcie usuwania Esc i klik w tło nie zamykają okna
      onOpenChange={(otwarte) => !otwarte && !pending && onCancel()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Content
          role="alertdialog"
          className="fixed top-1/2 left-1/2 z-50 flex w-[min(360px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-input bg-white px-5 pt-[18px] pb-4 text-sm text-foreground shadow-[0_16px_48px_rgba(0,0,0,.16)] outline-none"
        >
          <div>
            <Dialog.Title className="m-0 text-base font-semibold">
              Usunąć trening?
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
              Anuluj
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => void usun()}
            >
              Usuń
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
