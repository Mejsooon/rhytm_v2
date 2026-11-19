"use client";

// Lokalna kopia listy stron z optymistycznymi zmianami (kolejność, nazwa, ikona, ulubione).
// Błąd cofa zmianę i pokazuje toast. Nowe dane z serwera (po revalidatePath) zastępują kopię —
// wzorzec „poprzednie props”, jak w use-today-store.ts (Next 16 Activity nie montuje trasy od nowa).
import { useState } from "react";
import { toast } from "sonner";

import {
  reorderPages,
  renamePage,
  setFavorite,
  setPageIcon,
} from "./actions";
import type { PageSummary } from "./load-pages";
import { BLAD_ZAPISU } from "./messages";


export type PagesStore = ReturnType<typeof usePagesStore>;

export function usePagesStore(initial: PageSummary[]) {
  const [zrodlo, setZrodlo] = useState(initial);
  const [pages, setPages] = useState(initial);

  if (zrodlo !== initial) {
    setZrodlo(initial);
    setPages(initial);
  }

  // Wspólny szkielet: od razu pokazuje zmianę, a przy błędzie cofa tylko własną zmianę (funkcyjnie),
  // żeby nie nadpisać równoległych zmian innych pozycji
  async function zapisz(
    zmiana: (lista: PageSummary[]) => PageSummary[],
    cofniecie: (lista: PageSummary[]) => PageSummary[],
    akcja: () => Promise<{ ok: boolean }>,
  ): Promise<boolean> {
    setPages(zmiana);
    let udane = false;
    try {
      udane = (await akcja()).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setPages(cofniecie);
      toast.error(BLAD_ZAPISU);
    }
    return udane;
  }

  // Zmiana jednego pola jednej strony; cofnięcie przywraca tylko to pole tej strony
  function zmienPole<K extends "title" | "icon" | "favorite">(
    id: string,
    pole: K,
    wartosc: PageSummary[K],
    akcja: () => Promise<{ ok: boolean }>,
  ) {
    const stara = pages.find((p) => p.id === id)?.[pole];
    return zapisz(
      (l) => l.map((p) => (p.id === id ? { ...p, [pole]: wartosc } : p)),
      (l) => l.map((p) => (p.id === id && stara !== undefined ? { ...p, [pole]: stara } : p)),
      akcja,
    );
  }

  return {
    pages,
    reorder: (ids: string[]) => {
      const poprzednie = pages.map((p) => p.id);
      return zapisz(
        (l) =>
          ids
            .map((id) => l.find((p) => p.id === id))
            .filter((p): p is PageSummary => p !== undefined),
        // Cofnięcie układa obecną listę według dawnej kolejności (nowe pozycje na końcu)
        (l) => {
          const miejsce = (id: string) => {
            const i = poprzednie.indexOf(id);
            return i < 0 ? poprzednie.length : i;
          };
          return [...l].sort((x, y) => miejsce(x.id) - miejsce(y.id));
        },
        () => reorderPages(ids),
      );
    },
    rename: (id: string, title: string) => zmienPole(id, "title", title, () => renamePage(id, title)),
    setIcon: (id: string, icon: string) => zmienPole(id, "icon", icon, () => setPageIcon(id, icon)),
    setFavorite: (id: string, on: boolean) =>
      zmienPole(id, "favorite", on, () => setFavorite(id, on)),
    // Po usunięciu na serwerze (okno potwierdzenia czeka na serwer) strona znika z listy
    removeLocal: (id: string) => setPages((lista) => lista.filter((p) => p.id !== id)),
  };
}
