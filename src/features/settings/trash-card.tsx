"use client";

// Karta „Kosz” (Ustawienia → Ogólne): usunięte strony i wiersze z 30 dniami na przywrócenie.
// Makiety karty nie ma, więc układ jest po mojemu w estetyce pozostałych kart z Settings.dc.html.
import * as React from "react";
import { toast } from "sonner";

import {
  restorePage,
  restoreRow,
  type TrashData,
} from "@/features/pages/actions";
import { BLAD_ZAPISU } from "@/features/pages/messages";
import { rowsForm } from "@/features/pages/rows-label";

const PRZYCISK =
  "relative inline-flex h-9 flex-none cursor-pointer items-center justify-center rounded-md border border-[#e0e0e0] bg-white px-2.5 text-[13px] text-[#171717] outline-none hover:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-[#171717]/20 disabled:cursor-default disabled:opacity-40 after:absolute after:-inset-y-[5px] after:inset-x-0 after:content-['']";

const DZIEN_MS = 24 * 60 * 60 * 1000;

export function TrashCard({
  pages,
  rows,
  timeZone = "Europe/Warsaw",
}: TrashData & { timeZone?: string }) {
  const [strony, setStrony] = React.useState(pages);
  const [wiersze, setWiersze] = React.useState(rows);
  // Next 16 zachowuje stan trasy (Activity), więc po nowych danych z serwera stan lokalny trzeba zsynchronizować
  const [poprzednieStrony, setPoprzednieStrony] = React.useState(pages);
  const [poprzednieWiersze, setPoprzednieWiersze] = React.useState(rows);
  if (poprzednieStrony !== pages) {
    setPoprzednieStrony(pages);
    setStrony(pages);
  }
  if (poprzednieWiersze !== rows) {
    setPoprzednieWiersze(rows);
    setWiersze(rows);
  }
  const [teraz] = React.useState(() => Date.now());

  // „usunięto dd.mm.rrrr · zostało N dni” (N = 30 − pełne dni od usunięcia, minimum 0)
  function opis(deletedAt: string): string {
    const kiedy = new Date(deletedAt);
    const data = new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone,
    }).format(kiedy);
    const dni = Math.max(
      0,
      30 - Math.floor((teraz - kiedy.getTime()) / DZIEN_MS),
    );
    const slowo = rowsForm(dni) === "one" ? "dzień" : "dni";
    return `usunięto ${data} · zostało ${dni} ${slowo}`;
  }

  // Pozycja znika od razu; przy błędzie wraca na swoje miejsce i pojawia się toast
  async function przywrocStrone(strona: TrashData["pages"][number]) {
    const indeks = strony.findIndex((s) => s.id === strona.id);
    setStrony((l) => l.filter((s) => s.id !== strona.id));
    let udane = false;
    try {
      udane = (await restorePage(strona.id)).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setStrony((l) =>
        l.some((s) => s.id === strona.id)
          ? l
          : [...l.slice(0, indeks), strona, ...l.slice(indeks)],
      );
      toast.error(BLAD_ZAPISU);
    }
  }

  async function przywrocWiersz(wiersz: TrashData["rows"][number]) {
    const indeks = wiersze.findIndex((w) => w.id === wiersz.id);
    setWiersze((l) => l.filter((w) => w.id !== wiersz.id));
    let udane = false;
    try {
      udane = (await restoreRow(wiersz.id)).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setWiersze((l) =>
        l.some((w) => w.id === wiersz.id)
          ? l
          : [...l.slice(0, indeks), wiersz, ...l.slice(indeks)],
      );
      toast.error(BLAD_ZAPISU);
    }
  }

  const pusty = strony.length === 0 && wiersze.length === 0;

  return (
    <section
      id="kosz"
      className="scroll-mt-6 rounded-lg border border-[#eaeaea] bg-white"
    >
      <div className="p-5">
        <h2 className="m-0 text-base font-semibold">Kosz</h2>
        <p className="mt-1 mb-4 text-[#666666]">
          Usunięte strony i wiersze zostają tu przez 30 dni.
        </p>

        {pusty && (
          <p className="m-0 text-[13px] text-[#666666]">Kosz jest pusty.</p>
        )}

        {strony.length > 0 && (
          <section aria-label="Strony" className="mb-4 last:mb-0">
            <h3 className="m-0 mb-1 font-mono text-[11px] font-normal tracking-[0.06em] text-[#6b6b6b] uppercase">
              Strony
            </h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {strony.map((s) => {
                const nazwa = s.title.trim() === "" ? "Bez tytułu" : s.title;
                return (
                  <li
                    key={s.id}
                    aria-label={nazwa}
                    className="flex items-center gap-3 border-t border-[#f0f0f0] py-2 first:border-t-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{nazwa}</span>
                      <span className="font-mono text-xs text-[#6b6b6b]">
                        {opis(s.deletedAt)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={PRZYCISK}
                      onClick={() => void przywrocStrone(s)}
                    >
                      Przywróć
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {wiersze.length > 0 && (
          <section aria-label="Wiersze" className="mb-4 last:mb-0">
            <h3 className="m-0 mb-1 font-mono text-[11px] font-normal tracking-[0.06em] text-[#6b6b6b] uppercase">
              Wiersze
            </h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {wiersze.map((w) => (
                <li
                  key={w.id}
                  aria-label={w.title}
                  className="flex items-center gap-3 border-t border-[#f0f0f0] py-2 first:border-t-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{w.title}</span>
                    <span className="font-mono text-xs text-[#6b6b6b]">
                      {w.pageTitle.trim() === "" ? "Bez tytułu" : w.pageTitle} ·{" "}
                      {opis(w.deletedAt)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={PRZYCISK}
                    onClick={() => void przywrocWiersz(w)}
                  >
                    Przywróć
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}
