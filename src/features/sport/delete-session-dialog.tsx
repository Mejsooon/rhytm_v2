"use client";

// Zwarte potwierdzenie „Usunąć trening?” (wzór: DeleteBlockDialog). Sesja jest usuwana (kaskada),
// a wystąpienie szablonu zapisuje pominięcie (template_skips). Okno czeka na serwer.
import { useRef, useState } from "react";

import { ConfirmDialog } from "@/components/controls";
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
    <ConfirmDialog
      open
      onOpenChange={(otwarte) => !otwarte && onCancel()}
      title="Usunąć trening?"
      description={opis}
      error={blad}
      confirmLabel="Usuń"
      pending={pending}
      onConfirm={usun}
    />
  );
}
