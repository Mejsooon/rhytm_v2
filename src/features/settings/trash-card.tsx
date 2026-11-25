"use client";

// Karta „Kosz” (Ustawienia → Ogólne): usunięte strony i wiersze z 30 dniami na przywrócenie.
// Makiety karty nie ma, więc styl jak karty Profil i Cele z CSettings.dc.html (.card, wiersze z separatorem).
import * as React from "react";
import { toast } from "sonner";

import {
  restorePage,
  restoreRow,
  type TrashData,
} from "@/features/pages/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/controls";
import { BLAD_ZAPISU } from "@/features/pages/messages";
import { rowsForm } from "@/features/pages/rows-label";

const DZIEN_MS = 24 * 60 * 60 * 1000;

export function TrashCard({
  pages,
  rows,
  timeZone = "Europe/Warsaw",
  loadError = false,
}: TrashData & {
  timeZone?: string;
  // Odczyt kosza się nie udał — zamiast „Kosz jest pusty.” komunikat o błędzie
  loadError?: boolean;
}) {
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
    <Card id="kosz" data-testid="karta-kosz" className="scroll-mt-6">
      <CardHeader>
        <div>
          <CardTitle as="h2">Kosz</CardTitle>
          <CardDescription>
            Usunięte strony i wiersze zostają tu przez 30 dni.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="max-[799px]:px-0">
        {loadError && (
          <p role="alert" className="m-0 text-[13px] text-destructive-foreground max-[799px]:px-4">
            Nie udało się wczytać kosza.
          </p>
        )}
        {pusty && !loadError && (
          <p className="m-0 text-[13px] text-muted-foreground max-[799px]:px-4">Kosz jest pusty.</p>
        )}

        {strony.length > 0 && (
          <section aria-label="Strony" className="mb-4 last:mb-0">
            <h3 className="m-0 mb-1 text-xs font-medium text-muted-foreground max-[799px]:px-4">
              Strony
            </h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {strony.map((s) => {
                const nazwa = s.title.trim() === "" ? "Bez tytułu" : s.title;
                return (
                  <li
                    key={s.id}
                    aria-label={nazwa}
                    className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0 max-[799px]:min-h-14 max-[799px]:px-4"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{nazwa}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {opis(s.deletedAt)}
                      </span>
                    </span>
                    <Button onClick={() => void przywrocStrone(s)}>
                      Przywróć
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {wiersze.length > 0 && (
          <section aria-label="Wiersze" className="mb-4 last:mb-0">
            <h3 className="m-0 mb-1 text-xs font-medium text-muted-foreground max-[799px]:px-4">
              Wiersze
            </h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {wiersze.map((w) => (
                <li
                  key={w.id}
                  aria-label={w.title}
                  className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0 max-[799px]:min-h-14 max-[799px]:px-4"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{w.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {w.pageTitle.trim() === "" ? "Bez tytułu" : w.pageTitle} ·{" "}
                      {opis(w.deletedAt)}
                    </span>
                  </span>
                  <Button onClick={() => void przywrocWiersz(w)}>
                    Przywróć
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
