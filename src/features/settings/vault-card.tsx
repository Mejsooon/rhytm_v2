"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Segment,
  StatusBadge,
  Switch,
  TextField,
} from "@/components/controls";
import {
  masterPasswordStrength,
  MASTER_MIN_STRENGTH,
} from "@/features/vault/strength";
import { czasBlokady, DOMYSLNE_USTAWIENIA, type VaultSettings } from "@/features/vault/settings";
import { useVault } from "@/features/vault/vault-provider";
import { VaultResetDialog } from "@/features/vault/vault-reset-dialog";
import { VaultSetup } from "@/features/vault/vault-setup";
import { cn } from "@/lib/utils";

const ETYKIETY = [
  "Za krótkie",
  "Słabe",
  "Średnie",
  "Mocne",
  "Bardzo mocne",
] as const;
const ZLE_HASLO = "Nieprawidłowe hasło główne.";

// Zakładka Ustawienia → Sejf (S2SettingsVault): stan sejfu, blokada i schowek, zmiana hasła głównego,
// reset. Hasła istnieją tylko w stanie pól i są czyszczone zaraz po wysłaniu.
export function VaultCard({ liczbaHasel }: { liczbaHasel?: number }) {
  const { status, lock } = useVault();
  const [ustawianie, setUstawianie] = React.useState(false);
  const [reset, setReset] = React.useState(false);
  const id = React.useId();

  // Flaga formularza ustawiania gaśnie, gdy sejf przestaje być „brak” (po utworzeniu), żeby po resecie nie wracał formularz
  if (status !== "brak" && ustawianie) setUstawianie(false);
  if (status === "brak" && ustawianie) {
    return <VaultSetup onCancel={() => setUstawianie(false)} />;
  }

  const istnieje = status === "zablokowany" || status === "odblokowany";

  return (
    <>
      <Card role="region" aria-labelledby={`${id}-sejf`} data-testid="karta-sejf">
        <CardContent className="flex flex-wrap items-center gap-3 py-5 max-[799px]:px-4">
          <span className="flex size-10 flex-none items-center justify-center rounded-full border border-border bg-black/[.03]">
            <Lock aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle as="h2" id={`${id}-sejf`}>
                Sejf
              </CardTitle>
              {status === "brak" && <StatusBadge tone="gray">Nie ustawiony</StatusBadge>}
              {istnieje && (
                <StatusBadge tone={status === "odblokowany" ? "green" : "gray"}>
                  {status === "odblokowany" ? "Odblokowany" : "Zablokowany"}
                </StatusBadge>
              )}
            </div>
            {status === "ladowanie" && (
              <div role="status" className="text-[13px] text-muted-foreground">
                Wczytywanie…
              </div>
            )}
            {status === "nieobslugiwany" && (
              <div role="alert" className="text-[13px] text-destructive-foreground">
                Sejf wymaga nowoczesnej przeglądarki i połączenia HTTPS.
              </div>
            )}
            {status === "brak" && (
              <div className="text-[13px] text-muted-foreground">
                Ustaw hasło główne, żeby zapisywać hasła w module Hasła.
              </div>
            )}
            {istnieje && (
              <div className="text-[13px] text-muted-foreground">
                {liczbaHasel === undefined ? "" : `${liczbaHasel} ${odmienHasla(liczbaHasel)} · `}
                szyfrowanie AES-256 na Twoim urządzeniu
              </div>
            )}
          </div>
          {status === "brak" && (
            <Button variant="primary" onClick={() => setUstawianie(true)} className="max-[799px]:h-12">
              <Lock aria-hidden="true" className="size-4" />
              Ustaw sejf
            </Button>
          )}
          {istnieje && (
            <span className="flex flex-wrap gap-2 max-[799px]:w-full max-[799px]:[&>*]:h-12 max-[799px]:[&>*]:flex-1">
              <Button asChild>
                <Link href="/hasla">{status === "odblokowany" ? "Otwórz Hasła" : "Odblokuj"}</Link>
              </Button>
              {status === "odblokowany" && (
                <Button variant="primary" onClick={lock}>
                  <Lock aria-hidden="true" className="size-4" />
                  Zablokuj teraz
                </Button>
              )}
            </span>
          )}
        </CardContent>
      </Card>

      {istnieje && (
        <>
          <Blokada />
          <ZmianaHasla />

          <Card
            role="region"
            aria-labelledby={`${id}-strefa`}
            data-testid="karta-sejf-strefa"
            className="border-destructive-border"
          >
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5 max-[799px]:flex-col max-[799px]:items-stretch max-[799px]:bg-destructive/[.04] max-[799px]:px-4">
              <div>
                <CardTitle as="h2" id={`${id}-strefa`}>
                  Zresetuj sejf
                </CardTitle>
                <CardDescription>
                  Gdy nie pamiętasz hasła głównego. Usuwa wszystkie sekrety; serwisy, loginy i URL-e zostają.
                </CardDescription>
              </div>
              <Button variant="destructive" onClick={() => setReset(true)} className="max-[799px]:h-12">
                Zresetuj sejf…
              </Button>
            </CardContent>
          </Card>
        </>
      )}
      <VaultResetDialog open={reset} onOpenChange={setReset} />
    </>
  );
}

const odmienHasla = (n: number) =>
  n === 1 ? "hasło" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "hasła" : "haseł";

const WIERSZ = "flex flex-wrap items-center justify-between gap-3 border-t border-border py-3.5 first:border-t-0";

// „Blokada i schowek”: każda zmiana zapisuje się od razu na koncie
function Blokada() {
  const { settings = DOMYSLNE_USTAWIENIA, saveSettings, status, confirmReveal } = useVault();
  const [komunikat, setKomunikat] = React.useState("Zmiany zapisują się od razu.");

  async function zapisz(patch: Partial<VaultSettings>) {
    const wynik = await saveSettings(patch);
    setKomunikat(wynik.ok ? "Zapisano" : wynik.message);
  }

  const wiersz = (nazwa: string, opis: string, kontrolka: React.ReactNode) => (
    <div className={WIERSZ}>
      <div className="min-w-0">
        <div className="font-medium">{nazwa}</div>
        <div className="text-[13px] text-muted-foreground">{opis}</div>
      </div>
      {kontrolka}
    </div>
  );

  return (
    <Card data-testid="karta-sejf-blokada">
      <CardHeader>
        <div>
          <CardTitle as="h2">Blokada i schowek</CardTitle>
          <CardDescription>Sejf blokuje się sam — hasło główne nigdy nie opuszcza urządzenia.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="max-[799px]:px-4">
        {wiersz(
          "Automatyczna blokada",
          `Po ${czasBlokady(settings.lockMin)} bez aktywności`,
          <Segment
            ariaLabel="Automatyczna blokada"
            value={String(settings.lockMin)}
            onChange={(v) => void zapisz({ lockMin: Number(v) as VaultSettings["lockMin"] })}
            options={([1, 5, 15, 60] as const).map((m) => ({ value: String(m), label: czasBlokady(m) }))}
          />,
        )}
        {wiersz(
          "Blokada po zamknięciu karty",
          "Po powrocie trzeba wpisać hasło główne",
          <StatusBadge tone="gray">Zawsze włączona</StatusBadge>,
        )}
        {wiersz(
          "Czyść schowek",
          "Skopiowane hasło znika ze schowka po 30 s",
          <Switch
            ariaLabel="Czyść schowek"
            checked={settings.clearClipboard}
            onChange={(clearClipboard) => void zapisz({ clearClipboard })}
          />,
        )}
        {wiersz(
          "Pytaj o hasło przy podglądzie",
          "Także gdy sejf jest odblokowany; dotyczy też kopiowania",
          <Switch
            ariaLabel="Pytaj o hasło przy podglądzie"
            checked={settings.askOnReveal}
            // Wyłączenie też wymaga hasła, inaczej bramkę zdejmie każdy przy odblokowanym komputerze
            onChange={async (askOnReveal) => {
              if (!askOnReveal && status !== "odblokowany") setKomunikat("Odblokuj sejf, żeby to wyłączyć.");
              else if (askOnReveal || (await confirmReveal())) void zapisz({ askOnReveal });
            }}
          />,
        )}
      </CardContent>
      <CardFooter>
        <span role="status" className="text-[13px] text-muted-foreground">
          {komunikat}
        </span>
      </CardFooter>
    </Card>
  );
}

// Formularz zmiany hasła jako osobny komponent: odmontowuje się, gdy sejf znika (reset), więc pola się czyszczą
function ZmianaHasla() {
  const { status, changePassword } = useVault();
  const [obecne, setObecne] = React.useState("");
  const [nowe, setNowe] = React.useState("");
  const [powtorz, setPowtorz] = React.useState("");
  const [trwa, setTrwa] = React.useState(false);
  const [blad, setBlad] = React.useState<string | null>(null);
  const [zmieniono, setZmieniono] = React.useState(false);
  const id = React.useId();

  const sila = masterPasswordStrength(nowe);
  const roznia = powtorz.length > 0 && powtorz !== nowe;
  const mozna =
    obecne !== "" && sila >= MASTER_MIN_STRENGTH && nowe === powtorz && !trwa;
  // Kolor miernika: Za krótkie i Słabe czerwone, Średnie bursztynowe, wyżej zielone
  const kolorPaska =
    sila <= 1 ? "bg-destructive" : sila === 2 ? "bg-warning" : "bg-success";
  const kolorTekstu =
    sila <= 1
      ? "text-destructive-foreground"
      : sila === 2
        ? "text-warning-foreground"
        : "text-success";

  const bladStopki = blad !== null && blad !== ZLE_HASLO;
  // Próg „Min. „Mocne”” odpowiada MASTER_MIN_STRENGTH = 3; zaktualizuj tekst przy zmianie progu
  let komunikat = "Nie da się go odzyskać — zapisz je w bezpiecznym miejscu. Wymagane „Mocne”, 12+ znaków.";
  if (bladStopki) komunikat = blad;
  else if (zmieniono)
    komunikat =
      status === "zablokowany"
        ? "Hasło główne zmienione. Odblokuj sejf nowym hasłem."
        : "Hasło główne zmienione.";

  return (
    <form
      aria-labelledby={`${id}-haslo`}
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
      <Card data-testid="karta-sejf-haslo">
        <CardHeader>
          <div>
            <CardTitle as="h2" id={`${id}-haslo`}>
              Zmień hasło główne
            </CardTitle>
            <CardDescription>
              Inne niż hasło do konta. Zapisane sekrety zostają bez zmian.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3.5">
            <TextField
              label="Obecne hasło główne"
              type="password"
              autoComplete="current-password"
              value={obecne}
              onChange={(e) => {
                setObecne(e.target.value);
                setBlad(null);
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
                        className={cn(
                          "h-1 flex-1 rounded-sm",
                          i < sila ? kolorPaska : "bg-black/[.08]",
                        )}
                      />
                    ))}
                  </div>
                  <div
                    aria-live="polite"
                    className={cn("mt-1.5 text-xs", kolorTekstu)}
                  >
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
          <p className="mt-3 mb-0 text-[13px] text-muted-foreground">
            Zmiana hasła głównego nie zmienia klucza szyfrowania — stare kopie
            zapasowe nadal otwiera stare hasło.
          </p>
        </CardContent>
        <CardFooter className="max-[799px]:flex-col max-[799px]:items-stretch">
          <span
            role={bladStopki ? "alert" : "status"}
            className={cn(
              "text-[13px]",
              bladStopki
                ? "text-destructive-foreground"
                : zmieniono
                  ? "text-success"
                  : "text-muted-foreground",
            )}
          >
            {komunikat}
          </span>
          <Button
            variant="primary"
            type="submit"
            disabled={!mozna}
            className="max-[799px]:h-12"
          >
            Zmień hasło główne
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
