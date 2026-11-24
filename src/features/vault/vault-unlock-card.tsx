"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/controls";
import { VaultResetDialog } from "./vault-reset-dialog";
import { useVault } from "./vault-provider";

// Okno „Odblokuj sejf” (S2Vault.dc.html; pozycję i szerokość nadaje rodzic): hasło główne, „Odblokuj”, podpowiedź i link do resetu.
// Hasło żyje tylko w stanie pola i jest czyszczone zaraz po wysłaniu.
export function VaultUnlockCard() {
  const { unlock } = useVault();
  const [haslo, setHaslo] = React.useState("");
  const [blad, setBlad] = React.useState<string | null>(null);
  const [trwa, setTrwa] = React.useState(false);
  const [reset, setReset] = React.useState(false);
  const id = React.useId();

  return (
    <div
      role="dialog"
      aria-labelledby={`${id}-t`}
      className="w-full rounded-xl border border-border bg-white bg-clip-padding text-sm shadow-pop"
    >
      <form
        className="flex flex-col gap-4 px-6 pt-6 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (trwa) return;
          if (haslo === "") {
            setBlad("Wpisz hasło główne.");
            return;
          }
          // Hasło trafia tylko do providera; pole czyścimy od razu po wysłaniu
          const wpisane = haslo;
          setHaslo("");
          setBlad(null);
          setTrwa(true);
          void unlock(wpisane).then((wynik) => {
            setTrwa(false);
            if (!wynik.ok) setBlad(wynik.message);
          });
        }}
      >
        {/* Ukryta nazwa użytkownika: menedżer haseł zapisze hasło główne pod osobnym wpisem, nie pod kontem */}
        <input
          type="text"
          autoComplete="username"
          value="Sejf rhytm (hasło główne)"
          readOnly
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />
        <span className="grid size-10 place-items-center rounded-lg border border-border bg-panel shadow-xs">
          <Lock aria-hidden="true" className="size-[18px]" />
        </span>
        <div>
          <h2
            id={`${id}-t`}
            className="m-0 text-lg leading-[1.3] font-semibold"
          >
            Odblokuj sejf
          </h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Hasło główne sejfu, nie hasło do konta.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          <label htmlFor={`${id}-haslo`}>Hasło główne</label>
          {/* .igroup: ikona i pole w jednej ramce */}
          <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-white px-[11px] text-muted-foreground shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo has-[input[aria-invalid=true]]:border-destructive/[.36] max-[799px]:h-11">
            <Lock aria-hidden="true" className="size-4 flex-none" />
            <input
              id={`${id}-haslo`}
              type="password"
              autoFocus
              autoComplete="current-password"
              value={haslo}
              onChange={(e) => {
                setHaslo(e.target.value);
                setBlad(null);
              }}
              aria-invalid={blad ? true : undefined}
              aria-describedby={blad ? `${id}-blad` : undefined}
              className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-normal text-foreground outline-none max-[799px]:text-[15px]"
            />
          </div>
          {blad && (
            <p
              id={`${id}-blad`}
              className="m-0 text-xs font-normal text-destructive-foreground"
            >
              {blad}
            </p>
          )}
        </div>
        <Button
          variant="primary"
          type="submit"
          disabled={trwa}
          className="w-full"
        >
          Odblokuj
        </Button>
        <p className="m-0 text-xs leading-normal text-muted-foreground">
          Blokada po 5 min bezczynności.
        </p>
      </form>
      <div className="flex border-t border-border bg-black/[.025] px-4 py-3 min-[800px]:rounded-b-[11px]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReset(true)}
          className="text-destructive-foreground hover:text-destructive-foreground max-[799px]:h-11"
        >
          Nie pamiętam hasła — zresetuj sejf
        </Button>
      </div>
      <VaultResetDialog open={reset} onOpenChange={setReset} />
    </div>
  );
}
