"use client";

import * as React from "react";

import { Button, FormDialog } from "@/components/controls";

// „1 wartość”, „2 wartości”, „5 wartości” (odmiana pod liczbą jest taka sama od 2 wzwyż)
function wartosci(n: number): string {
  if (n === 1) return `${n} wartość`;
  return `${n} wartości`;
}

// Potwierdzenie zmiany typu pola, gdy część wartości nie da się przenieść (makieta nie ma tego tekstu).
// Okno czeka na serwer: „Zmień typ” blokuje się na czas zapisu. Używa go też widok strony z szablonu.
export function TypeChangeDialog({
  lost,
  onConfirm,
  onCancel,
}: {
  lost: number;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [trwa, setTrwa] = React.useState(false);

  async function potwierdz() {
    setTrwa(true);
    try {
      await onConfirm();
    } finally {
      setTrwa(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => {
        if (!otwarte && !trwa) onCancel();
      }}
      title="Zmienić typ pola?"
      footer={
        <>
          <Button onClick={onCancel} disabled={trwa}>
            Anuluj
          </Button>
          <Button variant="primary" onClick={potwierdz} disabled={trwa}>
            Zmień typ
          </Button>
        </>
      }
    >
      <p className="m-0 text-[13px] leading-normal text-[#666666]">
        {wartosci(lost)} nie da się przenieść i zostaną wyczyszczone.
      </p>
    </FormDialog>
  );
}
