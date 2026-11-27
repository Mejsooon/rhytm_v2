"use client";

// Karta „E-mail” (Ustawienia → Konto i bezpieczeństwo, S2SettingsAccount): adres i zmiana przez link
import * as React from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusBadge,
  TextField,
} from "@/components/controls";
import { requestEmailChange } from "./account-actions";

// Ten sam wzorzec co w makiecie; dokładną walidację robi serwer
const WZORZEC_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function AccountCard({
  email,
  newEmail,
  hasPassword,
  emailConfirmed,
}: {
  email: string;
  newEmail: string | null;
  hasPassword: boolean;
  emailConfirmed: boolean;
}) {
  const [edytuje, setEdytuje] = React.useState(false);
  const [adres, setAdres] = React.useState("");
  const [probowal, setProbowal] = React.useState(false);
  const [bladSerwera, setBladSerwera] = React.useState<string | null>(null);
  const [wysylam, setWysylam] = React.useState(false);
  // Adres, na który wysłaliśmy link w tej wizycie (zanim serwer odświeży new_email)
  const [wyslanoNa, setWyslanoNa] = React.useState<string | null>(null);

  const oczekujacy = wyslanoNa ?? newEmail;
  const bladFormatu =
    probowal && !WZORZEC_EMAIL.test(adres.trim())
      ? "To nie wygląda na adres e-mail."
      : null;
  const blad = bladFormatu ?? bladSerwera ?? undefined;

  let podpis = "Zmiana wymaga potwierdzenia na nowym adresie";
  if (!hasPassword) podpis = "Konto Google — adres zmienisz w Google";
  if (oczekujacy) podpis = `Link potwierdzający wysłany na ${oczekujacy}`;

  async function wyslij() {
    setProbowal(true);
    setBladSerwera(null);
    if (!WZORZEC_EMAIL.test(adres.trim())) return;
    setWysylam(true);
    try {
      const wynik = await requestEmailChange(adres);
      if (wynik.ok) {
        setWyslanoNa(adres.trim().toLowerCase());
        setEdytuje(false);
        setAdres("");
        setProbowal(false);
      } else {
        setBladSerwera(wynik.message);
      }
    } catch {
      setBladSerwera("Nie udało się wysłać linku. Spróbuj ponownie.");
    } finally {
      setWysylam(false);
    }
  }

  function anuluj() {
    setEdytuje(false);
    setAdres("");
    setProbowal(false);
    setBladSerwera(null);
  }

  return (
    <Card data-testid="karta-email">
      <CardHeader>
        <div>
          <CardTitle as="h2">E-mail</CardTitle>
          <CardDescription>
            Na ten adres logujesz się i dostajesz przypomnienia.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="max-[799px]:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-medium">
              <span className="break-all">{email}</span>
              <StatusBadge tone="green">Potwierdzony</StatusBadge>
            </div>
            <div className="text-xs text-muted-foreground">{podpis}</div>
            {emailConfirmed && (
              <div role="status" className="text-xs text-success">
                {newEmail
                  ? "Link potwierdzony. Kliknij jeszcze link na drugim adresie."
                  : "Link potwierdzony."}
              </div>
            )}
          </div>
          {hasPassword && !edytuje && (
            <Button variant="secondary" onClick={() => setEdytuje(true)}>
              Zmień e-mail
            </Button>
          )}
          {edytuje && (
            <div className="flex basis-full flex-wrap items-end gap-2">
              <div className="min-w-[240px] flex-[1_1_240px]">
                <TextField
                  label="Nowy e-mail"
                  type="email"
                  autoComplete="email"
                  placeholder="nowy@adres.pl"
                  value={adres}
                  error={blad}
                  onChange={(e) => {
                    setAdres(e.target.value);
                    setBladSerwera(null);
                  }}
                />
              </div>
              <Button variant="primary" disabled={wysylam} onClick={wyslij}>
                Wyślij link
              </Button>
              <Button variant="ghost" onClick={anuluj}>
                Anuluj
              </Button>
            </div>
          )}
          {wyslanoNa && !edytuje && (
            <div className="basis-full text-xs text-muted-foreground">
              Kliknij link w obu wiadomościach: na obecnym i na nowym adresie.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
