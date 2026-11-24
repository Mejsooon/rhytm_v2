"use client";

// Notatki do nawyku (karta spoza makiety webowej — jak karta „Historia harmonogramu” z CHabitDetail): lista + pole dodawania.
// Telefon (CMHabitDetail) to osobny blok JSX.
import { useRef, useState } from "react";

import { Plus } from "lucide-react";

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  FIELD,
} from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { addHabitNote } from "./actions";

export function HabitNotes({
  habitId,
  notes,
  phone = false,
}: {
  habitId: string;
  notes: { id: string; date: IsoDate; text: string }[];
  // Telefon (CMHabitDetail.dc.html): nagłówek nad kartą, data nad treścią notatki
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

  // Telefon (CMHabitDetail): nagłówek card-t nad kartą, notatka = data .hint nad tekstem,
  // ostatni wiersz to pole „Dodaj notatkę…” 16 px z przyciskiem „Zapisz notatkę” 44 px
  if (phone) {
    return (
      <section>
        <CardTitle as="h2" className="mb-2 text-[15px]">
          Notatki
        </CardTitle>
        <Card>
          {notes.map((n) => (
            <div
              key={n.id}
              className="m-row flex-col items-start gap-0.5 py-2.5"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                {`${n.date.slice(8)}.${n.date.slice(5, 7)}`}
              </span>
              <span className="min-w-0 break-words">{n.text}</span>
            </div>
          ))}
          <div className="m-row gap-2 pr-2">
            <input
              type="text"
              value={tekst}
              readOnly={pending}
              placeholder="Dodaj notatkę…"
              aria-label="Dodaj notatkę"
              onChange={(e) => setTekst(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void zapisz();
                }
              }}
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none"
            />
            <Button
              variant="ghost"
              icon
              aria-label="Zapisz notatkę"
              disabled={pending}
              onClick={() => void zapisz()}
            >
              <Plus size={18} aria-hidden="true" />
            </Button>
          </div>
          {blad && (
            <p
              role="alert"
              className="m-0 px-4 pb-3 text-xs text-destructive-foreground"
            >
              {blad}
            </p>
          )}
        </Card>
      </section>
    );
  }

  const karta = (
    <>
      {notes.map((n) => (
        <div
          key={n.id}
          className="flex gap-3 border-b border-border-soft px-6 py-3"
        >
          <span className="flex-none pt-px text-xs text-muted-foreground tabular-nums">
            {`${n.date.slice(8)}.${n.date.slice(5, 7)}`}
          </span>
          <span className="min-w-0 break-words">{n.text}</span>
        </div>
      ))}
      <div className="px-6 py-4">
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
          className={FIELD}
        />
        {blad && (
          <p
            role="alert"
            className="m-0 mt-2 text-xs text-destructive-foreground"
          >
            {blad}
          </p>
        )}
      </div>
    </>
  );

  // Web: .card z nagłówkiem .card-h
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
