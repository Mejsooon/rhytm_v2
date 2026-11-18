"use client";

// Notatki do nawyku (karta spoza makiety webowej — w stylu pozostałych kart): lista + pole dodawania.
import { useRef, useState } from "react";

import type { IsoDate } from "@/components/controls/calendar-math";
import { addHabitNote } from "./actions";

export function HabitNotes({
  habitId,
  notes,
}: {
  habitId: string;
  notes: { id: string; date: IsoDate; text: string }[];
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

  return (
    <section className="rounded-lg border border-[#eaeaea] bg-white">
      <div className="border-b border-[#eaeaea] px-4 py-3.5">
        <h2 className="m-0 text-[15px] font-semibold">Notatki</h2>
      </div>
      {notes.map((n) => (
        <div key={n.id} className="flex gap-3 border-b border-[#f0f0f0] px-4 py-3">
          <span className="font-mono text-xs text-[#6b6b6b]">{`${n.date.slice(8)}.${n.date.slice(5, 7)}`}</span>
          <span className="min-w-0 break-words">{n.text}</span>
        </div>
      ))}
      <div className="px-4 py-3">
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
          className="box-border w-full rounded-md border border-[#e0e0e0] bg-white px-2.5 py-2 text-sm text-[#171717] outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20 disabled:opacity-60"
        />
        {blad && (
          <p role="alert" className="m-0 mt-2 text-xs text-[#b91c1c]">
            {blad}
          </p>
        )}
      </div>
    </section>
  );
}
