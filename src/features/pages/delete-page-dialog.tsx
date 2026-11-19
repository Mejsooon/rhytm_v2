"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button, FormDialog } from "@/components/controls";
import { deletePage, restorePage } from "./actions";
import { rowsForm, rowsLabel } from "./rows-label";
import type { PageSummary } from "./load-pages";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Potwierdzenie usunięcia strony (PageMenu.dc.html, „Po kliknięciu „Usuń stronę””).
// Okno czeka na serwer; po sukcesie toast „Usunięto” z „Cofnij” → restorePage.
export function DeletePageDialog({
  page,
  open,
  onOpenChange,
  onDeleted,
}: {
  page: PageSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [trwa, setTrwa] = React.useState(false);
  const tytul = page.title.trim() === "" ? "Bez tytułu" : page.title;

  // „1 wiersz trafi”, „2 wiersze trafią”, „5 wierszy trafi”; strona bez wierszy nie ma czego odmieniać
  let tresc = "Strona trafi do kosza na 30 dni. Daty z tej strony znikną z kalendarza.";
  if (page.rowCount > 0) {
    const czasownik = rowsForm(page.rowCount) === "few" ? "trafią" : "trafi";
    tresc = `${rowsLabel(page.rowCount)} ${czasownik} do kosza na 30 dni. Daty z tej strony znikną z kalendarza.`;
  }

  async function usun() {
    setTrwa(true);
    let udane = false;
    try {
      udane = (await deletePage(page.id)).ok;
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
        onClick: () => {
          void restorePage(page.id);
        },
      },
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Usunąć stronę „${tytul}”?`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button variant="destructive" onClick={usun} disabled={trwa}>
            Usuń
          </Button>
        </>
      }
    >
      <p className="m-0 text-[13px] leading-normal text-[#666666]">{tresc}</p>
    </FormDialog>
  );
}
