"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/controls";
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
    <Dialog.Root
      open={open}
      // W trakcie usuwania Esc i klik w tło nie zamykają okna
      onOpenChange={(otwarte) => !trwa && onOpenChange(otwarte)}
    >
      <Dialog.Portal>
        {/* .backdrop z coss.css na webie; telefon: ciemniejsze tło bez rozmycia jak w FormDialog */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/[.32] backdrop-blur-[4px] max-[799px]:bg-black/40 max-[799px]:backdrop-blur-none" />
        <Dialog.Content
          // Web: jak okno usuwania w Sporcie (.dlg: promień 16 px, ramka border, cień pop, szara stopka .dlg-f);
          // telefon: arkusz od dołu z uchwytem, jak FormDialog poniżej 800 px
          className="fixed z-50 flex flex-col bg-white bg-clip-padding text-sm text-foreground outline-none min-[800px]:top-1/2 min-[800px]:left-1/2 min-[800px]:w-[min(400px,calc(100%-32px))] min-[800px]:-translate-x-1/2 min-[800px]:-translate-y-1/2 min-[800px]:rounded-xl min-[800px]:border min-[800px]:border-border min-[800px]:shadow-pop max-[799px]:inset-x-0 max-[799px]:bottom-0 max-[799px]:max-h-[92%] max-[799px]:rounded-t-[18px] max-[799px]:rounded-b-none max-[799px]:shadow-[0_-8px_30px_rgba(0,0,0,.12)]"
        >
          {/* Uchwyt arkusza — tylko na telefonie */}
          <div
            aria-hidden="true"
            className="mx-auto mt-2 mb-0.5 h-[5px] w-9 flex-none rounded-[3px] bg-border-strong min-[800px]:hidden"
          />
          <div className="px-6 pt-4 pb-4 min-[800px]:pt-6 min-[800px]:pb-5">
            <Dialog.Title className="m-0 text-base leading-[1.3] font-semibold min-[800px]:text-lg">
              {`Usunąć stronę „${tytul}”?`}
            </Dialog.Title>
            <Dialog.Description className="m-0 mt-1 text-[13px] text-muted-foreground min-[800px]:text-sm">
              {tresc}
            </Dialog.Description>
          </div>
          {/* Web: stopka .dlg-f na szarym tle; telefon: przyciski 44 px, odstęp od dołu */}
          <div className="flex justify-end gap-2 px-6 pb-7 min-[800px]:rounded-b-[15px] min-[800px]:border-t min-[800px]:border-border min-[800px]:bg-black/[.025] min-[800px]:py-4 min-[800px]:pb-4">
            <Button variant="ghost" disabled={trwa} onClick={() => onOpenChange(false)}>Anuluj</Button>
            <Button variant="destructive" onClick={usun} disabled={trwa}>
              <Trash2Icon aria-hidden="true" className="size-4 max-[799px]:hidden" />
              Usuń
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
