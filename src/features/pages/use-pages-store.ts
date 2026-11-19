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

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export type PagesStore = ReturnType<typeof usePagesStore>;

export function usePagesStore(initial: PageSummary[]) {
  const [zrodlo, setZrodlo] = useState(initial);
  const [pages, setPages] = useState(initial);

  if (zrodlo !== initial) {
    setZrodlo(initial);
    setPages(initial);
  }

  // Wspólny szkielet: od razu pokazuje zmianę, a przy błędzie wraca do poprzedniej listy
  async function zapisz(
    nastepna: PageSummary[],
    akcja: () => Promise<{ ok: boolean }>,
  ): Promise<boolean> {
    const poprzednia = pages;
    setPages(nastepna);
    let udane = false;
    try {
      udane = (await akcja()).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setPages(poprzednia);
      toast.error(BLAD_ZAPISU);
    }
    return udane;
  }

  return {
    pages,
    reorder: (ids: string[]) =>
      zapisz(
        ids
          .map((id) => pages.find((p) => p.id === id))
          .filter((p): p is PageSummary => p !== undefined),
        () => reorderPages(ids),
      ),
    rename: (id: string, title: string) =>
      zapisz(
        pages.map((p) => (p.id === id ? { ...p, title } : p)),
        () => renamePage(id, title),
      ),
    setIcon: (id: string, icon: string) =>
      zapisz(
        pages.map((p) => (p.id === id ? { ...p, icon } : p)),
        () => setPageIcon(id, icon),
      ),
    setFavorite: (id: string, on: boolean) =>
      zapisz(
        pages.map((p) => (p.id === id ? { ...p, favorite: on } : p)),
        () => setFavorite(id, on),
      ),
    // Po usunięciu na serwerze (okno potwierdzenia czeka na serwer) strona znika z listy
    removeLocal: (id: string) => setPages((lista) => lista.filter((p) => p.id !== id)),
  };
}
