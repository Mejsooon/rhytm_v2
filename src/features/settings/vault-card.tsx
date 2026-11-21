"use client";

import * as React from "react";
import { Lock, TriangleAlert } from "lucide-react";

import { Button, StatusBadge, TextField } from "@/components/controls";
import { masterPasswordStrength, MASTER_MIN_STRENGTH } from "@/features/vault/strength";
import { useVault } from "@/features/vault/vault-provider";
import { VaultResetDialog } from "@/features/vault/vault-reset-dialog";
import { VaultSetup } from "@/features/vault/vault-setup";
import { cn } from "@/lib/utils";

const ETYKIETY = ["Za krótkie", "Słabe", "Średnie", "Mocne", "Bardzo mocne"] as const;
const ZLE_HASLO = "Nieprawidłowe hasło główne.";

// Zakładka Ustawienia → Sejf (styl CSettingsAccount.dc.html): stan sejfu, zmiana hasła głównego,
// strefa niebezpieczna. Hasła istnieją tylko w stanie pól i są czyszczone zaraz po wysłaniu.
export function VaultCard() {
  const { status, createdAt, changePassword, lock } = useVault();
  const [ustawianie, setUstawianie] = React.useState(false);
  const [reset, setReset] = React.useState(false);
  const [obecne, setObecne] = React.useState("");
  const [nowe, setNowe] = React.useState("");
  const [powtorz, setPowtorz] = React.useState("");
  const [trwa, setTrwa] = React.useState(false);
  const [blad, setBlad] = React.useState<string | null>(null);
  const [zmieniono, setZmieniono] = React.useState(false);
  const id = React.useId();

  const sila = masterPasswordStrength(nowe);
  const roznia = powtorz.length > 0 && powtorz !== nowe;
  const mozna = obecne !== "" && sila >= MASTER_MIN_STRENGTH && nowe === powtorz && !trwa;
  // Kolor miernika: Za krótkie i Słabe czerwone, Średnie bursztynowe, wyżej zielone
  const kolorPaska = sila <= 1 ? "bg-destructive" : sila === 2 ? "bg-warning" : "bg-success";
  const kolorTekstu =
    sila <= 1 ? "text-destructive-foreground" : sila === 2 ? "text-warning-foreground" : "text-success";

  // Data utworzenia jako dd.mm.rrrr (createdAt przychodzi dopiero po wczytaniu sejfu w przeglądarce)
  const data = createdAt
    ? new Date(createdAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  if (status === "brak" && ustawianie) {
    return <VaultSetup onCancel={() => setUstawianie(false)} />;
  }

  const kartaKlasy = "rounded-lg border border-border bg-white";
  const wierszKlasy =
    "flex flex-wrap items-center justify-between gap-3 border-b border-border py-3.5 last:border-b-0 max-[799px]:flex-col max-[799px]:items-stretch";

  return (
    <>
      <section aria-labelledby={`${id}-sejf`} className={kartaKlasy}>
        <div className="p-5 pb-2">
          <h2 id={`${id}-sejf`} className="m-0 text-base font-semibold">
            Sejf
          </h2>
          <p className="mt-1 mb-0 text-muted-foreground">
            Szyfruje pola „Sekret” w przeglądarce. Serwer widzi tylko szyfrogram.
          </p>
        </div>
        <div className="px-5 pb-2">
          {status === "ladowanie" && (
            <div role="status" className="py-3.5 text-[13px] text-muted-foreground">
              Wczytywanie…
            </div>
          )}
          {status === "nieobslugiwany" && (
            <div role="alert" className="py-3.5 text-[13px] text-destructive-foreground">
              Sejf wymaga nowoczesnej przeglądarki i połączenia HTTPS.
            </div>
          )}
          {status === "brak" && (
            <div className={wierszKlasy}>
              <div>
                <div className="flex items-center gap-2 font-medium">
                  Nie ustawiony
                  <StatusBadge tone="gray">Brak</StatusBadge>
                </div>
                <div className="text-[13px] text-muted-foreground">
                  Ustaw hasło główne, żeby zapisywać sekrety w tabelach Passwords.
                </div>
              </div>
              <Button variant="primary" onClick={() => setUstawianie(true)} className="max-[799px]:h-12">
                <Lock aria-hidden="true" className="size-4" />
                Ustaw sejf
              </Button>
            </div>
          )}
          {(status === "zablokowany" || status === "odblokowany") && (
            <div className={wierszKlasy}>
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {data ? `Ustawiony ${data}` : "Ustawiony"}
                  <StatusBadge tone={status === "odblokowany" ? "green" : "gray"}>
                    {status === "odblokowany" ? "Odblokowany" : "Zablokowany"}
                  </StatusBadge>
                </div>
                <div className="text-[13px] text-muted-foreground">
                  Klucz zostaje tylko w pamięci tej karty. Blokada po 5 min bezczynności.
                </div>
              </div>
              {status === "odblokowany" && (
                <Button onClick={lock} className="max-[799px]:h-12">
                  <Lock aria-hidden="true" className="size-4" />
                  Zablokuj teraz
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {(status === "zablokowany" || status === "odblokowany") && (
        <>
          <form
            aria-labelledby={`${id}-haslo`}
            className={kartaKlasy}
            onSubmit={(e) => {
              e.preventDefault();
              if (!mozna) return;
              // Hasła trafiają tylko do providera; pola czyścimy od razu po wysłaniu (także po błędzie)
              const stare = obecne;
              const nowyWpis = nowe;
              setObecne("");
              setNowe("");
              setPowtorz("");
              setBlad(null);
              setZmieniono(false);
              setTrwa(true);
              void changePassword(stare, nowyWpis).then((wynik) => {
                setTrwa(false);
                if (wynik.ok) setZmieniono(true);
                else setBlad(wynik.message);
              });
            }}
          >
            <div className="p-5">
              <h2 id={`${id}-haslo`} className="m-0 text-base font-semibold">
                Zmień hasło główne
              </h2>
              <p className="mt-1 mb-4 text-muted-foreground">
                Hasło główne nie jest hasłem do konta. Zapisane sekrety zostają bez zmian.
              </p>
              <div className="flex flex-col gap-3.5">
                <TextField
                  label="Obecne hasło główne"
                  type="password"
                  autoComplete="current-password"
                  value={obecne}
                  onChange={(e) => {
                    setObecne(e.target.value);
                    setZmieniono(false);
                  }}
                  error={blad === ZLE_HASLO ? blad : undefined}
                />
                <div className="grid grid-cols-2 gap-3 max-[799px]:grid-cols-1">
                  <div className="flex flex-col gap-1.5">
                    <TextField
                      label="Nowe hasło główne"
                      type="password"
                      autoComplete="new-password"
                      value={nowe}
                      onChange={(e) => {
                        setNowe(e.target.value);
                        setZmieniono(false);
                      }}
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
                  </div>
                  <TextField
                    label="Powtórz nowe hasło"
                    type="password"
                    autoComplete="new-password"
                    value={powtorz}
                    onChange={(e) => {
                      setPowtorz(e.target.value);
                      setZmieniono(false);
                    }}
                    error={roznia ? "Hasła się różnią." : undefined}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-b-lg border-t border-border bg-panel px-5 py-3 max-[799px]:flex-col max-[799px]:items-stretch">
              <span
                role={blad && blad !== ZLE_HASLO ? "alert" : "status"}
                className={cn(
                  "text-[13px]",
                  blad && blad !== ZLE_HASLO ? "text-destructive-foreground" : zmieniono ? "text-success" : "text-muted-foreground",
                )}
              >
                {blad && blad !== ZLE_HASLO ? blad : zmieniono ? "Hasło główne zmienione." : "Min. „Średnie”, 12+ znaków."}
              </span>
              <Button variant="primary" type="submit" disabled={!mozna} className="max-[799px]:h-12">
                Zmień hasło
              </Button>
            </div>
          </form>

          <section aria-labelledby={`${id}-strefa`} className="rounded-lg border border-destructive-border bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 max-[799px]:flex-col max-[799px]:items-stretch">
              <div>
                <h2 id={`${id}-strefa`} className="m-0 flex items-center gap-2 text-base font-semibold text-destructive-foreground">
                  <TriangleAlert aria-hidden="true" className="size-4 flex-none" />
                  Strefa niebezpieczna
                </h2>
                <p className="mt-1 mb-0 text-muted-foreground">
                  Reset usuwa wszystkie zapisane sekrety. Serwisy, loginy i URL-e zostają.
                </p>
              </div>
              <Button variant="destructive-outline" onClick={() => setReset(true)} className="max-[799px]:h-12">
                Zresetuj sejf
              </Button>
            </div>
          </section>
        </>
      )}
      <VaultResetDialog open={reset} onOpenChange={setReset} />
    </>
  );
}
