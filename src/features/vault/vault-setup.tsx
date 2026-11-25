"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, TriangleAlert, X } from "lucide-react";

import { Button, Checkbox, EmptyState, TextField } from "@/components/controls";
import { cn } from "@/lib/utils";
import { masterPasswordStrength, MASTER_MIN_STRENGTH } from "./strength";
import { useVault } from "./vault-provider";

const ETYKIETY = ["Za krótkie", "Słabe", "Średnie", "Mocne", "Bardzo mocne"] as const;

// Ustawienie hasła głównego sejfu (CVaultSetup.dc.html) jako karta w miejscu tabeli.
// Hasła istnieją tylko w stanie pól i są czyszczone zaraz po wysłaniu.
// `ekran` (telefon, CMVaultSetup.dc.html): zamiast karty pełny ekran pod nagłówkiem „Hasła” — opis, ostrzeżenie,
// pola 44 px, miernik, zgoda, „Utwórz sejf” i „Anuluj” (link do listy stron). Obie wersje mają tę samą logikę
// i te same progi (min. „Mocne”, 12+ znaków); wybiera je rodzic, a CSS przełącza układ przy 800 px.
export function VaultSetup({ onCancel, ekran = false }: { onCancel: () => void; ekran?: boolean }) {
  const { setup } = useVault();
  const [haslo, setHaslo] = React.useState("");
  const [powtorz, setPowtorz] = React.useState("");
  const [zgoda, setZgoda] = React.useState(false);
  const [trwa, setTrwa] = React.useState(false);
  const [blad, setBlad] = React.useState<string | null>(null);
  const id = React.useId();

  const sila = masterPasswordStrength(haslo);
  const roznia = powtorz.length > 0 && powtorz !== haslo;
  const mozna = sila >= MASTER_MIN_STRENGTH && haslo === powtorz && zgoda && !trwa;
  // Kolor miernika: Za krótkie i Słabe czerwone, Średnie bursztynowe, wyżej zielone
  const kolorPaska = sila <= 1 ? "bg-destructive" : sila === 2 ? "bg-warning" : "bg-success";
  const kolorTekstu =
    sila <= 1 ? "text-destructive-foreground" : sila === 2 ? "text-warning-foreground" : "text-success";

  function wyslij(e: React.FormEvent) {
    e.preventDefault();
    if (!mozna) return;
    // Hasło trafia tylko do providera; pola czyścimy od razu po wysłaniu
    const wpisane = haslo;
    setHaslo("");
    setPowtorz("");
    setBlad(null);
    setTrwa(true);
    void setup(wpisane).then((wynik) => {
      setTrwa(false);
      if (!wynik.ok) setBlad(wynik.message);
    });
  }

  // Telefon: pełny ekran według CMVaultSetup
  if (ekran) {
    return (
      <form aria-labelledby={`${id}-t`} className="flex flex-col gap-4 py-2 text-sm text-foreground" onSubmit={wyslij}>
        {/* Ukryta nazwa użytkownika: menedżer haseł zapisze hasło główne pod osobnym wpisem, nie pod kontem */}
        <input type="text" autoComplete="username" value="Sejf rhytm (hasło główne)" readOnly hidden aria-hidden="true" tabIndex={-1} />
        <EmptyState
          className="gap-2.5 p-0"
          icon={<Lock aria-hidden="true" className="size-[22px]" />}
          title="Ustaw hasło główne sejfu"
          titleAs="h2"
          titleId={`${id}-t`}
          titleClassName="text-[22px]"
          description="Hasło główne szyfruje moduł Hasła i pola „Sekret” na Twoim urządzeniu."
        />
        <div className="rounded-xl border border-warning-border bg-warning/[.05] px-3.5 py-3 text-[13px]">
          <strong>Hasło tylko do sejfu!</strong> Nie używaj hasła do konta. Nie da się go odzyskać.
        </div>
        <TextField
          label="Hasło główne"
          type="password"
          autoComplete="new-password"
          value={haslo}
          onChange={(e) => setHaslo(e.target.value)}
          aria-describedby={`${id}-sila`}
        />
        {/* Miernik: 4 paski 4 px tuż pod polem i podpis (puste pole: wymagania) */}
        <div id={`${id}-sila`} className="-mt-2 flex flex-col gap-1.5">
          <div className="grid grid-cols-4 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} data-segment="" className={cn("h-1 rounded-sm", i < sila ? kolorPaska : "bg-black/[.08]")} />
            ))}
          </div>
          <div aria-live="polite" className="text-xs text-muted-foreground">
            {haslo === "" ? "Min. „Mocne”, 12+ znaków." : ETYKIETY[sila]}
          </div>
        </div>
        <TextField
          label="Powtórz"
          type="password"
          autoComplete="new-password"
          value={powtorz}
          onChange={(e) => setPowtorz(e.target.value)}
          error={roznia ? "Hasła się różnią." : undefined}
        />
        <Checkbox
          checked={zgoda}
          onChange={setZgoda}
          label="Rozumiem, że zapomnianego hasła głównego nie da się odzyskać."
        />
        {blad && (
          <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
            {blad}
          </p>
        )}
        <Button variant="primary" type="submit" disabled={!mozna} className="w-full">
          Utwórz sejf
        </Button>
        <Button variant="ghost" asChild className="w-full">
          <Link href="/strony">Anuluj</Link>
        </Button>
      </form>
    );
  }

  return (
    <form
      aria-labelledby={`${id}-t`}
      className="mx-auto flex w-full max-w-[500px] flex-col rounded-xl border border-border bg-white bg-clip-padding text-sm text-foreground shadow-pop"
      onSubmit={wyslij}
    >
      {/* Ukryta nazwa użytkownika: menedżer haseł zapisze hasło główne pod osobnym wpisem, nie pod kontem */}
      <input type="text" autoComplete="username" value="Sejf rhytm (hasło główne)" readOnly hidden aria-hidden="true" tabIndex={-1} />
      <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
        <div>
          <h2 id={`${id}-t`} className="m-0 text-lg leading-[1.3] font-semibold">
            Ustaw hasło główne sejfu
          </h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Szyfruje pola „Sekret” w przeglądarce. Serwer widzi tylko szyfrogram.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Zamknij" onClick={onCancel} className="max-[799px]:size-11">
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-5">
        <TextField
          label="Hasło główne"
          type="password"
          autoComplete="new-password"
          value={haslo}
          onChange={(e) => setHaslo(e.target.value)}
          aria-describedby={`${id}-sila`}
        />
        <div id={`${id}-sila`}>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                data-segment=""
                className={cn("h-1 flex-1 rounded-sm", i < sila ? kolorPaska : "bg-black/[.08]")}
              />
            ))}
          </div>
          <div aria-live="polite" className={cn("mt-1.5 text-xs", kolorTekstu)}>
            {ETYKIETY[sila]}
          </div>
        </div>
        <TextField
          label="Powtórz"
          type="password"
          autoComplete="new-password"
          value={powtorz}
          onChange={(e) => setPowtorz(e.target.value)}
          error={roznia ? "Hasła się różnią." : undefined}
        />
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive-border bg-destructive/[.04] px-3.5 py-3 text-sm">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 flex-none" />
          <span>
            <b>Nie da się go odzyskać.</b> Jeśli je zapomnisz, jedyna opcja to reset sejfu, który usuwa wszystkie
            zapisane sekrety. To nie jest hasło do konta.
          </span>
        </div>
        <Checkbox
          checked={zgoda}
          onChange={setZgoda}
          label="Rozumiem, że zapomnianego hasła głównego nie da się odzyskać."
        />
        {blad && (
          <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
            {blad}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-[11px] border-t border-border bg-black/[.025] px-6 py-4">
        <Button variant="ghost" onClick={onCancel}>
          Anuluj
        </Button>
        <Button variant="primary" type="submit" disabled={!mozna}>
          <Lock aria-hidden="true" className="size-4" />
          Utwórz sejf
        </Button>
      </div>
    </form>
  );
}
