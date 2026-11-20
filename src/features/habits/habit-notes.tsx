"use client";

// Notatki do nawyku (karta spoza makiety webowej — jak karta „Historia harmonogramu” z CHabitDetail): lista + pole dodawania.
// Telefon zostaje w dotychczasowym wyglądzie.
import { useRef, useState } from "react";

import { CardHeader, CardTitle, FIELD } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { addHabitNote } from "./actions";

export function HabitNotes({
  habitId,
  notes,
  phone = false,
}: {
  habitId: string;
  notes: { id: string; date: IsoDate; text: string }[];
  // Telefon (MHabitDetail.dc.html): nagłówek nad kartą, data nad treścią notatki
  phone?: boolean;
}) {
  const [tekst, setTekst] = useState("");
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego zapisu (szybkie dwa Entery)
  const zapisuje = useRef(false);

  async function zapisz() {
    const przyciete = tekst.trim();
    if (przyciete === "" || zapisuje.current) return;
    zapisuje.current = true;
    setPending(true);
    setBlad("");
    try {
      const wynik = await addHabitNote(habitId, przyciete);
      if (!wynik.ok) {
        setBlad(wynik.message);
        return;
      }
      setTekst("");
    } catch {
      setBlad("Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      zapisuje.current = false;
      setPending(false);
    }
  }

  const karta = (
    <>
      {notes.map((n) => (
        <div
          key={n.id}
          className={
            phone
              ? "flex flex-col gap-0.5 border-b border-border px-3.5 py-3"
              : "flex gap-3 border-b border-border-soft px-6 py-3"
          }
        >
          <span
            className={
              phone
                ? "font-mono text-[11px] text-muted-foreground"
                : "flex-none pt-px text-xs text-muted-foreground tabular-nums"
            }
          >
            {`${n.date.slice(8)}.${n.date.slice(5, 7)}`}
          </span>
          <span className="min-w-0 break-words">{n.text}</span>
        </div>
      ))}
      <div className={phone ? "px-3.5 py-3" : "px-6 py-4"}>
        <input
          type="text"
          value={tekst}
          readOnly={pending}
          placeholder="Dodaj notatkę"
          aria-label="Dodaj notatkę"
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void zapisz();
            }
          }}
          // Web: pole .inp (FIELD); telefon jak dotąd
          className={
            phone
              ? "box-border w-full rounded-md border border-input bg-white px-2.5 py-2 text-sm text-foreground outline-none focus-visible:shadow-focus disabled:opacity-60 max-[799px]:h-11 max-[799px]:rounded-md max-[799px]:text-[15px]"
              : FIELD
          }
        />
        {blad && (
          <p role="alert" className="m-0 mt-2 text-xs text-destructive-foreground">
            {blad}
          </p>
        )}
      </div>
    </>
  );

  if (phone) {
    return (
      <section>
        <h2 className="m-0 mb-2 text-[17px] font-semibold">Notatki</h2>
        <div className="rounded-xl border border-border bg-white">
          {karta}
        </div>
      </section>
    );
  }
  return (
    // .card z nagłówkiem .card-h i linią nad listą jak w „Historii harmonogramu”
    <section className="relative flex min-w-0 flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-card">
      <CardHeader className="pb-3.5">
        <CardTitle as="h2">Notatki</CardTitle>
      </CardHeader>
      <div className="border-t border-border">{karta}</div>
    </section>
  );
}
