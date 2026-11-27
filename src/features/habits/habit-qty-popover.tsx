"use client";

// Okienko częściowej ilości nawyku („1 z 2 l”): − / +, pole liczby, „Cały cel”, „Zapisz”.
import { useState } from "react";
import { toast } from "sonner";

import { ActionPopover, Button } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { setHabitProgress } from "./actions";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// 0.5 → „0,5”
export const formatQty = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export function HabitQtyPopover({
  habit,
  date,
  qty,
  done,
  trigger,
}: {
  habit: { id: string; name: string; goalQty: number; goalUnit: string };
  date: IsoDate;
  // Dotychczasowy częściowy postęp
  qty: number;
  done: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tekst, setTekst] = useState("");
  const [pending, setPending] = useState(false);
  // Krok przycisków: ćwierć celu (2 l → 0,5; 20 min → 5)
  const krok = Math.max(0.01, Math.round((habit.goalQty / 4) * 100) / 100);
  const liczba = Number(tekst.replace(",", "."));
  const poprawna = tekst.trim() !== "" && Number.isFinite(liczba) && liczba >= 0;

  async function zapisz(ile: number) {
    if (pending) return;
    setPending(true);
    const wynik = await setHabitProgress(habit.id, date, ile).catch(() => null);
    setPending(false);
    if (wynik?.ok) setOpen(false);
    else toast.error(wynik?.message ?? BLAD_ZAPISU);
  }

  const zmien = (o: number) =>
    setTekst(formatQty(Math.max(0, (poprawna ? liczba : 0) + o)));

  return (
    <ActionPopover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setTekst(formatQty(done ? habit.goalQty : qty));
      }}
      align="end"
      width={220}
      ariaLabel={`Ilość: ${habit.name}`}
      trigger={trigger}
    >
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (poprawna) void zapisz(liczba);
        }}
      >
        <span className="text-xs text-muted-foreground">
          {`Cel: ${formatQty(habit.goalQty)} ${habit.goalUnit}`}
        </span>
        <div className="flex items-center gap-1.5">
          <Button type="button" icon aria-label="Mniej" onClick={() => zmien(-krok)}>
            −
          </Button>
          <input
            inputMode="decimal"
            aria-label="Zrobiona ilość"
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-center text-sm tabular-nums outline-none focus-visible:shadow-focus"
          />
          <Button type="button" icon aria-label="Więcej" onClick={() => zmien(krok)}>
            +
          </Button>
        </div>
        <div className="flex justify-between gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={() => void zapisz(habit.goalQty)}>
            Cały cel
          </Button>
          <Button type="submit" size="sm" variant="primary" disabled={!poprawna || pending}>
            Zapisz
          </Button>
        </div>
      </form>
    </ActionPopover>
  );
}
