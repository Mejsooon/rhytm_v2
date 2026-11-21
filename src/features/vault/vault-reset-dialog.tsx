"use client";

import * as React from "react";

import { Button, FormDialog, WordConfirm } from "@/components/controls";
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
      footer={
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Anuluj
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-destructive-border bg-destructive/[.04] px-3.5 py-3">
          <div className="text-xs font-medium text-destructive-foreground">Zostanie usunięte</div>
          <div className="mt-1 text-xl font-semibold text-destructive-foreground tabular-nums">
            {liczba === null ? "—" : `${liczba} ${odmiana}`}
          </div>
        </div>
        <div className="rounded-xl border border-border px-3.5 py-3">
          <div className="text-xs font-medium text-muted-foreground">Zostaje</div>
          <div className="mt-2 text-sm">serwisy, loginy, URL-e</div>
        </div>
      </div>
      <p className="m-0 text-sm leading-normal text-muted-foreground">
        Pola „Sekret” zostaną wyczyszczone, a potem ustawisz nowe hasło główne.
      </p>
      <WordConfirm
        word="RESETUJ"
        label="Wpisz RESETUJ, żeby potwierdzić"
        confirmLabel="Zresetuj sejf"
        destructive
        onConfirm={() => {
          if (trwa.current) return;
          trwa.current = true;
          setBlad(null);
          void reset().then((wynik) => {
            trwa.current = false;
            if (wynik.ok) onOpenChange(false);
            else setBlad(wynik.message);
          });
        }}
      />
      {blad && (
        <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
          {blad}
        </p>
      )}
    </FormDialog>
  );
}
