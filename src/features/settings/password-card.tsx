"use client";

// Karta „Zmień hasło do konta” (Ustawienia → Konto i bezpieczeństwo, S2SettingsAccount.dc.html).
// Konto tylko z Google dostaje zamiast formularza kartę „Ustaw hasło do konta” z linkiem z maila.
import * as React from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FIELD,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { changePassword, sendSetPasswordLink } from "./account-actions";

// Kolory pasków siły wg makiety: 0 = szary, 1–4 od czerwonego do zielonego
const KOLORY_SILY = [
  "rgba(0,0,0,.08)",
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#15803d",
];
const PODPISY_SILY = ["Za krótkie", "Słabe", "Średnie", "Dobre", "Mocne"];

// Etykieta pola (.fld z coss.css)
const ETYKIETA = "flex flex-col gap-2 text-sm font-medium text-foreground";

export function PasswordCard({
  hasPassword,
  email,
}: {
  hasPassword: boolean;
  email: string;
}) {
  const [obecne, setObecne] = React.useState("");
  const [nowe, setNowe] = React.useState("");
  const [powtorz, setPowtorz] = React.useState("");
  const [zmienione, setZmienione] = React.useState(false);
  const [zapisuje, setZapisuje] = React.useState(false);
  const [bladSerwera, setBladSerwera] = React.useState<string | null>(null);
  // Wariant Google: wynik wysyłki linku
  const [linkWyslany, setLinkWyslany] = React.useState<string | null>(null);
  const [bladLinku, setBladLinku] = React.useState<string | null>(null);
  const [wysylam, setWysylam] = React.useState(false);
  const id = React.useId();

  if (!hasPassword) {
    const wyslijLink = async () => {
      setWysylam(true);
      setBladLinku(null);
      try {
        const wynik = await sendSetPasswordLink();
        if (wynik.ok) setLinkWyslany(wynik.email);
        else setBladLinku(wynik.message);
      } catch {
        setBladLinku("Nie udało się wysłać linku. Spróbuj ponownie.");
      } finally {
        setWysylam(false);
      }
    };

    return (
      <Card data-testid="karta-haslo">
        <CardHeader>
          <div>
            <CardTitle as="h2">Ustaw hasło do konta</CardTitle>
            <CardDescription>
              Logujesz się przez Google. Wyślemy link do ustawienia hasła na{" "}
              {email}.
            </CardDescription>
          </div>
        </CardHeader>
        <CardFooter className="mt-5">
          <span
            role="status"
            className={cn(
              "text-[13px]",
              bladLinku
                ? "text-destructive-foreground"
                : linkWyslany
                  ? "text-success"
                  : "text-muted-foreground",
            )}
          >
            {bladLinku ??
              (linkWyslany ? `Link wysłany na ${linkWyslany}.` : "")}
          </span>
          <Button
            variant="primary"
            aria-disabled={wysylam}
            onClick={() => {
              if (!wysylam) void wyslijLink();
            }}
          >
            Wyślij link
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Siła wg makiety: długość ≥ 10, wielka litera, cyfra, znak spoza [A-Za-z0-9]
  const wynik =
    (nowe.length >= 10 ? 1 : 0) +
    (/[A-Z]/.test(nowe) ? 1 : 0) +
    (/[0-9]/.test(nowe) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(nowe) ? 1 : 0);
  const kolor = KOLORY_SILY[wynik];
  const zgodne = !!powtorz && powtorz === nowe;
  const poprawne = !!obecne && nowe.length >= 10 && zgodne && nowe !== obecne;

  // Komunikat w stopce: kolejność z makiety
  let komunikat = "Min. 10 znaków. Wylogujemy inne urządzenia.";
  if (obecne || nowe || powtorz) {
    if (!obecne) komunikat = "Wpisz obecne hasło.";
    else if (nowe.length < 10) komunikat = "Nowe hasło: min. 10 znaków.";
    else if (nowe === obecne)
      komunikat = "Nowe hasło musi różnić się od obecnego.";
    else if (!zgodne) komunikat = "Hasła muszą być takie same.";
    else komunikat = "Gotowe — wylogujemy inne urządzenia.";
  }
  if (zmienione)
    komunikat = "Hasło zmienione ✓ Inne urządzenia zostały wylogowane.";

  // Każda zmiana pola chowa poprzedni wynik
  function zmien(ustaw: (v: string) => void, wartosc: string) {
    ustaw(wartosc);
    setZmienione(false);
    setBladSerwera(null);
  }

  async function zapisz() {
    if (!poprawne || zapisuje) return;
    setZapisuje(true);
    setBladSerwera(null);
    try {
      const odp = await changePassword({
        current: obecne,
        next: nowe,
        repeat: powtorz,
      });
      if (odp.ok) {
        setObecne("");
        setNowe("");
        setPowtorz("");
        setZmienione(true);
      } else {
        setBladSerwera(odp.message);
      }
    } catch {
      setBladSerwera("Nie udało się zmienić hasła. Spróbuj ponownie.");
    } finally {
      setZapisuje(false);
    }
  }

  return (
    <Card data-testid="karta-haslo">
      <CardHeader>
        <div>
          <CardTitle as="h2">Zmień hasło do konta</CardTitle>
          <CardDescription>Hasło do konta nie otwiera sejfu.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5 max-[799px]:gap-3 max-[799px]:px-4">
        <div className={ETYKIETA}>
          <label htmlFor={`${id}-obecne`}>Obecne hasło</label>
          <input
            id={`${id}-obecne`}
            className={FIELD}
            type="password"
            autoComplete="current-password"
            value={obecne}
            onChange={(e) => zmien(setObecne, e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 max-[799px]:grid-cols-1">
          <div className={ETYKIETA}>
            <label htmlFor={`${id}-nowe`}>Nowe hasło</label>
            <input
              id={`${id}-nowe`}
              aria-describedby={`${id}-sila`}
              className={FIELD}
              type="password"
              autoComplete="new-password"
              value={nowe}
              onChange={(e) => zmien(setNowe, e.target.value)}
            />
            <span
              className="mt-0.5 grid grid-cols-4 gap-1"
              data-testid="paski-sily"
              aria-hidden="true"
            >
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-1 rounded-[2px]"
                  style={{
                    background: i < wynik ? kolor : "rgba(0,0,0,.08)",
                  }}
                />
              ))}
            </span>
            <span
              id={`${id}-sila`}
              className="text-xs font-normal text-muted-foreground"
            >
              {nowe
                ? `${PODPISY_SILY[wynik]} hasło`
                : "10+ znaków, wielka litera, cyfra, znak"}
            </span>
          </div>
          <div className={ETYKIETA}>
            <label htmlFor={`${id}-powtorz`}>Powtórz</label>
            <input
              id={`${id}-powtorz`}
              aria-describedby={`${id}-zgodnosc`}
              className={FIELD}
              type="password"
              autoComplete="new-password"
              value={powtorz}
              aria-invalid={powtorz && !zgodne ? true : undefined}
              onChange={(e) => zmien(setPowtorz, e.target.value)}
            />
            <span
              id={`${id}-zgodnosc`}
              className={cn(
                "min-h-[1lh] text-xs font-normal",
                !powtorz
                  ? "text-muted-foreground"
                  : zgodne
                    ? "text-[13px] text-success"
                    : "text-destructive-foreground",
              )}
            >
              {!powtorz
                ? " "
                : zgodne
                  ? "Hasła są takie same ✓"
                  : "Hasła się różnią"}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="max-[799px]:flex-col max-[799px]:items-stretch max-[799px]:px-4">
        <span
          role="status"
          className={cn(
            "text-[13px]",
            bladSerwera
              ? "text-destructive-foreground"
              : zmienione || poprawne
                ? "text-success"
                : "text-muted-foreground",
          )}
        >
          {bladSerwera ?? komunikat}
        </span>
        <Button
          variant="primary"
          aria-disabled={!poprawne || zapisuje}
          className="aria-disabled:pointer-events-none aria-disabled:opacity-[.45] max-[799px]:w-full"
          onClick={() => void zapisz()}
        >
          Zmień hasło
        </Button>
      </CardFooter>
    </Card>
  );
}
