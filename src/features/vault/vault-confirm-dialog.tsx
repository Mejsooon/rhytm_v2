"use client";

// „Pytaj o hasło przy podglądzie”: hasło główne przed pokazaniem albo skopiowaniem sekretu.
// To bramka na ekranie (ktoś przy odblokowanym komputerze), nie dodatkowe szyfrowanie.
import * as React from "react";

import { Button, FormDialog, TextField } from "@/components/controls";

export function VaultConfirmDialog({
  verify,
  onDone,
}: {
  verify: (password: string) => Promise<boolean>;
  onDone: (ok: boolean) => void;
}) {
  const [haslo, setHaslo] = React.useState("");
  const [blad, setBlad] = React.useState<string | null>(null);
  const [trwa, setTrwa] = React.useState(false);
  const id = React.useId();

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onDone(false)}
      title="Potwierdź hasłem głównym"
      footer={
        <>
          <Button variant="ghost" onClick={() => onDone(false)}>
            Anuluj
          </Button>
          <Button variant="primary" type="submit" form={id} disabled={haslo === "" || trwa}>
            Potwierdź
          </Button>
        </>
      }
    >
      <form
        id={id}
        onSubmit={(e) => {
          e.preventDefault();
          if (haslo === "" || trwa) return;
          const wpisane = haslo;
          setHaslo("");
          setBlad(null);
          setTrwa(true);
          void verify(wpisane)
            .catch(() => false)
            .then((ok) => {
              setTrwa(false);
              if (ok) onDone(true);
              else setBlad("Nieprawidłowe hasło główne.");
            });
        }}
      >
        <input type="text" autoComplete="username" value="Sejf rhytm (hasło główne)" readOnly hidden />
        <TextField
          label="Hasło główne"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={haslo}
          onChange={(e) => setHaslo(e.target.value)}
          error={blad ?? undefined}
        />
      </form>
    </FormDialog>
  );
}
