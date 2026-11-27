"use client";

// Lista kosza (S2Trash): „Przywróć” od razu, „Usuń na zawsze” po potwierdzeniu.
import * as React from "react";
import { Layers } from "lucide-react";
import { toast } from "sonner";

import { Button, Card, ConfirmDialog } from "@/components/controls";
import {
  deletePageForever,
  deleteRowForever,
  restorePage,
  restoreRow,
  type TrashData,
} from "@/features/pages/actions";
import { BLAD_ZAPISU } from "@/features/pages/messages";
import { rowsForm } from "@/features/pages/rows-label";

const DZIEN_MS = 24 * 60 * 60 * 1000;

type Pozycja = { id: string; nazwa: string; strona: boolean; opis: string };

export function TrashList({
  pages,
  rows,
  timeZone = "Europe/Warsaw",
  loadError = false,
}: TrashData & {
  timeZone?: string;
  // Odczyt kosza się nie udał — zamiast „Kosz jest pusty.” komunikat o błędzie
  loadError?: boolean;
}) {
  const [teraz] = React.useState(() => Date.now());
  // Pozycje przywrócone albo usunięte w tej wizycie (znikają od razu, przy błędzie wracają)
  const [zdjete, setZdjete] = React.useState<ReadonlySet<string>>(new Set());
  // Next 16 zachowuje stan trasy (Activity): po nowych danych z serwera ta sama pozycja może wrócić do kosza
  const [dla, setDla] = React.useState({ pages, rows });
  if (dla.pages !== pages || dla.rows !== rows) {
    setDla({ pages, rows });
    setZdjete(new Set());
  }
  const [usuwana, setUsuwana] = React.useState<Pozycja | null>(null);

  // „usunięta 20.11 · zostało 26 dni” (N = 30 − pełne dni od usunięcia, minimum 0)
  function kiedy(deletedAt: string, slowo: string): string {
    const data = new Date(deletedAt);
    const dzien = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", timeZone }).format(data);
    const dni = Math.max(0, 30 - Math.floor((teraz - data.getTime()) / DZIEN_MS));
    return `${slowo} ${dzien} · zostało ${dni} ${rowsForm(dni) === "one" ? "dzień" : "dni"}`;
  }
  const nazwaStrony = (t: string) => (t.trim() === "" ? "Bez tytułu" : t);

  const pozycje: Pozycja[] = [
    ...pages.map((s) => ({
      id: s.id,
      nazwa: nazwaStrony(s.title),
      strona: true,
      kiedy: s.deletedAt,
      opis: `strona · ${kiedy(s.deletedAt, "usunięta")}`,
    })),
    ...rows.map((w) => ({
      id: w.id,
      nazwa: w.title,
      strona: false,
      kiedy: w.deletedAt,
      opis: `wiersz w ${nazwaStrony(w.pageTitle)} · ${kiedy(w.deletedAt, "usunięty")}`,
    })),
  ]
    .sort((a, b) => b.kiedy.localeCompare(a.kiedy))
    .filter((p) => !zdjete.has(p.id));

  async function wykonaj(p: Pozycja, akcja: () => Promise<{ ok: boolean }>, sukces: string) {
    setZdjete((z) => new Set(z).add(p.id));
    const wynik = await akcja().catch(() => null);
    if (wynik?.ok) {
      toast.success(sukces);
      return;
    }
    setZdjete((z) => new Set([...z].filter((id) => id !== p.id)));
    toast.error(BLAD_ZAPISU);
  }

  if (loadError) {
    return (
      <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
        Nie udało się wczytać kosza.
      </p>
    );
  }

  return (
    <Card className="p-0">
      {pozycje.length === 0 ? (
        <p className="m-0 px-4 py-4 text-muted-foreground">Kosz jest pusty.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {pozycje.map((p) => (
            <li
              key={p.id}
              aria-label={p.nazwa}
              className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3.5 first:border-t-0"
            >
              <span className="flex size-8 flex-none items-center justify-center rounded-lg bg-black/[.05] text-muted-foreground">
                <Layers aria-hidden="true" className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{p.nazwa}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{p.opis}</span>
              </span>
              <Button
                size="sm"
                onClick={() =>
                  void wykonaj(
                    p,
                    () => (p.strona ? restorePage(p.id, true) : restoreRow(p.id)),
                    `Przywrócono „${p.nazwa}”.`,
                  )
                }
              >
                Przywróć
              </Button>
              <Button size="sm" variant="destructive-outline" onClick={() => setUsuwana(p)}>
                Usuń na zawsze
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={usuwana !== null}
        onOpenChange={(o) => !o && setUsuwana(null)}
        title={`Usunąć na zawsze „${usuwana?.nazwa}”?`}
        description={
          usuwana?.strona
            ? "Strona zniknie razem ze wszystkimi wierszami. Tego nie da się cofnąć."
            : "Wiersz zniknie na stałe. Tego nie da się cofnąć."
        }
        confirmLabel="Usuń na zawsze"
        onConfirm={() => {
          const p = usuwana;
          if (!p) return;
          setUsuwana(null);
          void wykonaj(
            p,
            () => (p.strona ? deletePageForever(p.id) : deleteRowForever(p.id)),
            `Usunięto na zawsze „${p.nazwa}”.`,
          );
        }}
      />
    </Card>
  );
}
