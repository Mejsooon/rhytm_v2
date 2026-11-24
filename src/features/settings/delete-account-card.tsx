"use client";

// Karta „Usuń konto” (Ustawienia → Ogólne, S2Settings.dc.html): czerwona ramka, potwierdzenie słowem USUŃ.
// Teksty mówią o 30 dniach na przywrócenie zamiast trwałego usunięcia (decyzja C2).
import * as React from "react";
import { unstable_rethrow } from "next/navigation";

import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FIELD,
  Kbd,
  matchesWord,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { requestAccountDeletion } from "./account-actions";

// Stopka karty w czerwonym tonie (makieta: tło rgba(239,68,68,.04), linia rgba(239,68,68,.16))
const STOPKA = "border-destructive/[.16] bg-destructive/[.04]";

export function DeleteAccountCard() {
  const [pyta, setPyta] = React.useState(false);
  const [slowo, setSlowo] = React.useState("");
  const [blad, setBlad] = React.useState<string | null>(null);
  const [trwa, startTransition] = React.useTransition();
  const poleId = React.useId();

  // Jak w makiecie: trim + wielkie litery („ usuń ” też przechodzi)
  const zgodne = matchesWord(slowo, "USUŃ");

  function usun() {
    if (!zgodne || trwa) return;
    setBlad(null);
    startTransition(async () => {
      try {
        // Sukces kończy się przekierowaniem na /logowanie?konto=usuniete
        const wynik = await requestAccountDeletion(slowo);
        if (wynik && !wynik.ok) setBlad(wynik.message);
      } catch (e) {
        // Przekierowanie z akcji obsługuje Next — przepuszczamy je; tu zostaje błąd sieci
        unstable_rethrow(e);
        setBlad("Nie udało się usunąć konta. Spróbuj ponownie.");
      }
    });
  }

  return (
    <Card data-testid="karta-usun-konto" className="border-destructive/[.24]">
      <CardHeader className="pb-5">
        <div>
          <CardTitle as="h2">Usuń konto</CardTitle>
          <CardDescription>
            Konto zostanie usunięte po 30 dniach razem ze stronami, sejfem i
            danymi modułów. Do tego czasu możesz je przywrócić, logując się.
            Zdjęcie profilowe usuwamy od razu.
          </CardDescription>
        </div>
      </CardHeader>
      {!pyta ? (
        <CardFooter className={cn("justify-end", STOPKA)}>
          <Button
            variant="destructive"
            onClick={() => {
              setPyta(true);
              setSlowo("");
              setBlad(null);
            }}
          >
            Usuń konto
          </Button>
        </CardFooter>
      ) : (
        <CardFooter className={cn("items-end", STOPKA)}>
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2 text-sm font-medium text-[#b91c1c]">
            <label htmlFor={poleId}>
              Wpisz{" "}
              <Kbd className="bg-white text-[#b91c1c] shadow-[inset_0_0_0_1px_rgba(239,68,68,.24)]">
                USUŃ
              </Kbd>
              , żeby potwierdzić
            </label>
            <input
              id={poleId}
              type="text"
              value={slowo}
              onChange={(e) => {
                setSlowo(e.target.value);
                setBlad(null);
              }}
              placeholder="USUŃ"
              autoComplete="off"
              autoFocus
              aria-describedby={blad ? `${poleId}-blad` : undefined}
              className={FIELD}
            />
            {blad && (
              <p
                id={`${poleId}-blad`}
                role="alert"
                className="m-0 text-xs font-normal text-destructive-foreground"
              >
                {blad}
              </p>
            )}
          </div>
          <span className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setPyta(false);
                setSlowo("");
                setBlad(null);
              }}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              aria-disabled={!zgodne || trwa}
              onClick={usun}
            >
              Usuń konto
            </Button>
          </span>
        </CardFooter>
      )}
    </Card>
  );
}
