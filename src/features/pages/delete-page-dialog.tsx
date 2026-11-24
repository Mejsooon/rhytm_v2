"use client";

import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/controls";
import { countPageRows, deletePage, restorePage } from "./actions";
import { rowsForm, rowsLabel } from "./rows-label";
import { BLAD_ZAPISU } from "./messages";
import type { PageSummary } from "./load-pages";

// Potwierdzenie usunięcia strony (PageMenu.dc.html, „Po kliknięciu „Usuń stronę””).
// Liczba wierszy czyta się na świeżo przy otwarciu (licznik z listy stron bywa nieaktualny).
// Okno czeka na serwer; po sukcesie toast „Usunięto” z „Cofnij” → restorePage.
// `onDeleteStart` biegnie zaraz po wysłaniu usunięcia, jeszcze przed odpowiedzią serwera.
export function DeletePageDialog({
  page,
  open,
  onOpenChange,
  onDeleteStart,
  onDeleted,
}: {
  page: PageSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteStart?: () => void;
  onDeleted: () => void;
}) {
  const [trwa, setTrwa] = React.useState(false);
  // Świeża liczba wierszy; do czasu odpowiedzi (albo przy błędzie) liczba z listy stron
  const [liczba, setLiczba] = React.useState<number | null>(null);
  const [poprzednioOtwarte, setPoprzednioOtwarte] = React.useState(open);
  if (poprzednioOtwarte !== open) {
    setPoprzednioOtwarte(open);
    if (open) setLiczba(null);
  }
  React.useEffect(() => {
    if (!open) return;
    let aktualne = true;
    countPageRows(page.id)
      .then((w) => {
        if (aktualne && w.ok) setLiczba(w.count);
      })
      .catch(() => {});
    return () => {
      aktualne = false;
    };
  }, [open, page.id]);

  const tytul = page.title.trim() === "" ? "Bez tytułu" : page.title;
  const wiersze = liczba ?? page.rowCount;

  // „1 wiersz trafi”, „2 wiersze trafią”, „5 wierszy trafi”; strona bez wierszy nie ma czego odmieniać
  let tresc = "Strona trafi do kosza na 30 dni. Daty z tej strony znikną z kalendarza.";
  if (wiersze > 0) {
    const czasownik = rowsForm(wiersze) === "few" ? "trafią" : "trafi";
    tresc = `${rowsLabel(wiersze)} ${czasownik} do kosza na 30 dni. Daty z tej strony znikną z kalendarza.`;
  }

  async function usun() {
    setTrwa(true);
    let udane = false;
    try {
      const usuwanie = deletePage(page.id);
      onDeleteStart?.();
      udane = (await usuwanie).ok;
    } catch {
      udane = false;
    }
    setTrwa(false);
    if (!udane) {
      toast.error(BLAD_ZAPISU);
      return;
    }
    onOpenChange(false);
    onDeleted();
    toast("Usunięto", {
      action: {
        label: "Cofnij",
        onClick: async () => {
          let przywrocono = false;
          try {
            przywrocono = (await restorePage(page.id)).ok;
          } catch {
            przywrocono = false;
          }
          if (!przywrocono) toast.error(BLAD_ZAPISU);
        },
      },
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Usunąć stronę „${tytul}”?`}
      description={tresc}
      confirmLabel="Usuń"
      pending={trwa}
      onConfirm={usun}
    />
  );
}
