"use client";

import * as React from "react";

import { Button, FormDialog, matchesWord, WordConfirm } from "@/components/controls";
import { rowsForm } from "@/features/pages/rows-label";
import { countSecrets } from "./actions";
import { useVault } from "./vault-provider";

// Okno resetu sejfu (CVaultReset.dc.html): ile sekretów zniknie, co zostaje i potwierdzenie słowem
// RESETUJ. Po udanym resecie zamyka się; status sejfu zmienia się wtedy na „brak”.
export function VaultResetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { reset } = useVault();
  // Liczba niepustych sekretów (null — jeszcze nieznana lub błąd odczytu)
  const [liczba, setLiczba] = React.useState<number | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);
  // Wpisane słowo potwierdzenia (przycisk jest w stopce, więc stan trzymamy tutaj)
  const [wpisane, setWpisane] = React.useState("");
  const zgodne = matchesWord(wpisane, "RESETUJ");
  // Chroni przed podwójnym wysłaniem resetu
  const trwa = React.useRef(false);

  // Liczba sekretów jest pobierana przy każdym otwarciu; po zamknięciu stara wartość znika
  React.useEffect(() => {
    if (!open) return;
    let aktualne = true;
    void countSecrets()
      .then((res) => {
        if (aktualne) setLiczba(res.ok ? res.count : null);
      })
      .catch(() => {
        if (aktualne) setLiczba(null);
      });
    return () => {
      aktualne = false;
      setLiczba(null);
      setBlad(null);
      setWpisane("");
    };
  }, [open]);

  const forma = liczba === null ? "many" : rowsForm(liczba);
  const odmiana = forma === "one" ? "sekret" : forma === "few" ? "sekrety" : "sekretów";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Zresetować sejf?"
      description="Tej operacji nie da się cofnąć."
      // Telefon (CMVaultReset): tytuł 20 px, opis pod tytułem, przyciski w dwóch równych kolumnach bez szarej stopki
      titleClassName="max-[799px]:text-xl"
      descriptionClassName="max-[799px]:block"
      phoneClose={false}
      footerClassName="max-[799px]:grid max-[799px]:grid-cols-2 max-[799px]:gap-2.5 max-[799px]:border-t-0 max-[799px]:bg-transparent max-[799px]:px-5 max-[799px]:pt-0"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            variant="destructive"
            aria-disabled={!zgodne}
            onClick={() => {
              if (!zgodne || trwa.current) return;
              trwa.current = true;
              setBlad(null);
              void reset().then((wynik) => {
                trwa.current = false;
                if (wynik.ok) onOpenChange(false);
                else setBlad(wynik.message);
              });
            }}
          >
            Zresetuj sejf
          </Button>
        </>
      }
    >
      {/* Web: dwa kafelki obok siebie; telefon: jedna karta z dwoma wierszami (etykieta po lewej, wartość po prawej) */}
      <div className="grid grid-cols-2 gap-2.5 max-[799px]:flex max-[799px]:flex-col max-[799px]:gap-0 max-[799px]:overflow-hidden max-[799px]:rounded-xl max-[799px]:border max-[799px]:border-border max-[799px]:py-1">
        <div className="rounded-xl border border-destructive-border bg-destructive/[.04] px-3.5 py-3 max-[799px]:flex max-[799px]:min-h-12 max-[799px]:items-center max-[799px]:gap-3 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:bg-transparent max-[799px]:px-4 max-[799px]:py-0">
          <div className="text-xs font-medium text-destructive-foreground max-[799px]:flex-1 max-[799px]:text-sm max-[799px]:font-normal">
            Zostanie usunięte
          </div>
          <div className="mt-1 text-xl font-semibold text-destructive-foreground tabular-nums max-[799px]:mt-0 max-[799px]:text-sm max-[799px]:font-medium">
            {liczba === null ? "—" : `${liczba} ${odmiana}`}
          </div>
        </div>
        <div className="rounded-xl border border-border px-3.5 py-3 max-[799px]:flex max-[799px]:min-h-12 max-[799px]:items-center max-[799px]:gap-3 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:px-4 max-[799px]:py-0">
          <div className="text-xs font-medium text-muted-foreground max-[799px]:flex-1 max-[799px]:text-sm max-[799px]:font-normal max-[799px]:text-foreground">
            Zostaje
          </div>
          <div className="mt-2 text-sm max-[799px]:mt-0 max-[799px]:text-muted-foreground">serwisy, loginy, URL-e</div>
        </div>
      </div>
      <p className="m-0 text-sm leading-normal text-muted-foreground max-[799px]:text-xs">
        Pola „Sekret” zostaną wyczyszczone, a potem ustawisz nowe hasło główne.
      </p>
      <WordConfirm
        word="RESETUJ"
        label="Wpisz RESETUJ, żeby potwierdzić"
        labelClassName="max-[799px]:text-destructive-foreground"
        confirmLabel="Zresetuj sejf"
        destructive
        hideButton
        value={wpisane}
        onValueChange={setWpisane}
        onConfirm={() => {}}
      />
      {blad && (
        <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
          {blad}
        </p>
      )}
    </FormDialog>
  );
}
