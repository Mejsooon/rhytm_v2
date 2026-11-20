"use client";

import * as React from "react";
import { X } from "lucide-react";

import { filterSlash, type SlashItem } from "../../blocks";

// Arkusz „Wstaw blok” (MEditor.dc.html): lista pozycji z filtrem z pola poleceń. Bez modala Radixa, żeby pisanie „/tab” w polu pod spodem dalej filtrowało listę.
export function MInsertSheet({
  open,
  query,
  onPick,
  onClose,
  focusSheet,
}: {
  open: boolean;
  query: string;
  onPick: (item: SlashItem) => void;
  onClose: () => void;
  // Otwarty przyciskiem „+”: fokus wchodzi do arkusza i Tab krąży tylko po nim.
  // Otwarty przez „/” w polu poleceń: fokus zostaje w polu, żeby dalsze pisanie filtrowało listę.
  focusSheet: boolean;
}) {
  const arkuszRef = React.useRef<HTMLDivElement>(null);
  const tytulRef = React.useRef<HTMLHeadingElement>(null);

  // Esc zamyka arkusz z dowolnego miejsca; Tab nie wychodzi poza arkusz, gdy ma fokus
  React.useEffect(() => {
    if (!open) return;
    function przyKlawiszu(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !focusSheet || !arkuszRef.current) return;
      const aktywne = Array.from(arkuszRef.current.querySelectorAll<HTMLElement>("button"));
      const pierwszy = aktywne[0];
      const ostatni = aktywne[aktywne.length - 1];
      const biezacy = document.activeElement;
      if (!arkuszRef.current.contains(biezacy)) {
        e.preventDefault();
        pierwszy?.focus();
      } else if (e.shiftKey && (biezacy === pierwszy || biezacy === tytulRef.current)) {
        e.preventDefault();
        ostatni?.focus();
      } else if (!e.shiftKey && biezacy === ostatni) {
        e.preventDefault();
        pierwszy?.focus();
      }
    }
    document.addEventListener("keydown", przyKlawiszu);
    return () => document.removeEventListener("keydown", przyKlawiszu);
  }, [open, focusSheet, onClose]);

  React.useEffect(() => {
    if (open && focusSheet) tytulRef.current?.focus();
  }, [open, focusSheet]);

  if (!open) return null;
  const pozycje = filterSlash(query);

  return (
    <>
      <button
        type="button"
        aria-label="Zamknij menu"
        onClick={onClose}
        className="fixed inset-0 z-50 cursor-pointer border-0 bg-black/40 min-[800px]:hidden"
      />
      <div
        role="dialog"
        aria-label="Wstaw blok"
        ref={arkuszRef}
        className="fixed inset-x-0 bottom-0 z-[51] flex max-h-[92%] flex-col rounded-t-[18px] bg-white shadow-[0_-8px_30px_rgba(0,0,0,.12)] min-[800px]:hidden"
      >
        <div aria-hidden="true" className="mx-auto mt-2 mb-0.5 h-[5px] w-9 flex-none rounded-[3px] bg-border-strong" />
        <div className="flex flex-none items-center py-0.5 pr-2 pl-5">
          <h2 ref={tytulRef} tabIndex={-1} className="m-0 flex-1 text-[17px] font-semibold outline-none">Wstaw blok</h2>
          <button
            type="button"
            aria-label="Zamknij"
            onClick={onClose}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-foreground hover:bg-muted"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-3 pb-[30px]">
          {pozycje.map((p, i) => (
            <button
              key={p.type}
              type="button"
              onClick={() => onPick(p)}
              className={`flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-xl border-0 p-2 text-left font-[inherit] ${
                i === 0 && query.trim() !== "" ? "bg-muted" : "bg-transparent"
              }`}
            >
              <span
                aria-hidden="true"
                className="flex size-10 flex-none items-center justify-center rounded-md border border-border bg-white font-mono"
              >
                {p.icon}
              </span>
              <span className="flex flex-col text-left">
                <span className="font-medium">{p.name}</span>
                <span className="text-[13px] text-muted-foreground">{p.desc}</span>
              </span>
            </button>
          ))}
          {pozycje.length === 0 && (
            <p className="m-0 px-2 py-3 text-[13px] text-muted-foreground">Brak bloku „{query.trim()}”</p>
          )}
        </div>
      </div>
    </>
  );
}
