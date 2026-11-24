"use client";

// Karta „Konto” (Ustawienia → Ogólne, S2Settings.dc.html): e-mail ze zmianą przez link, hasło do konta, sesja z „Wyloguj”
import * as React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
  TextField,
} from "@/components/controls";
import { signOut } from "@/features/auth/actions";
import { requestEmailChange } from "./account-actions";

// Ten sam wzorzec co w makiecie; dokładną walidację robi serwer
const WZORZEC_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Wiersz karty (.row): 14 px w pionie, linia między wierszami
const WIERSZ =
  "flex flex-wrap items-center justify-between gap-2.5 border-b border-black/[.08] py-3.5 last:border-b-0";

export function AccountCard({
  email,
  newEmail,
  hasPassword,
  passwordChangedAt,
  sessionLabel,
  emailConfirmed,
  timeZone,
}: {
  email: string;
  newEmail: string | null;
  hasPassword: boolean;
  passwordChangedAt: string | null;
  sessionLabel: string;
  emailConfirmed: boolean;
  timeZone: string;
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

  // Podpis e-maila: konto Google, link czeka na potwierdzenie albo zwykły potwierdzony adres
  let podpisEmail = `${email} · potwierdzony`;
  if (!hasPassword) podpisEmail = `${email} · konto Google`;
  if (oczekujacy)
    podpisEmail = `${email} · link potwierdzający wysłany na ${oczekujacy}`;

  // Data zmiany hasła w strefie z profilu (DD.MM.RRRR)
  let podpisHasla = "ustawione przy rejestracji";
  if (!hasPassword) podpisHasla = "brak — logujesz się przez Google";
  else if (passwordChangedAt) {
    const data = new Date(passwordChangedAt);
    if (!Number.isNaN(data.getTime()))
      podpisHasla = `zmienione ${new Intl.DateTimeFormat("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone,
      }).format(data)}`;
  }

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
    <Card data-testid="karta-konto">
      <CardHeader>
        <div>
          <CardTitle as="h2">Konto</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="py-1.5">
        <div className={WIERSZ}>
          <div>
            <div className="font-medium">E-mail</div>
            <div className="text-xs text-muted-foreground">{podpisEmail}</div>
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
              Zmień
            </Button>
          )}
          {edytuje && (
            <div className="flex basis-full flex-wrap items-start gap-2">
              <div className="min-w-[240px] flex-[1_1_240px] [&_label]:sr-only">
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

        <div className={WIERSZ}>
          <div>
            <div className="font-medium">Hasło do konta</div>
            <div className="text-xs text-muted-foreground">{podpisHasla}</div>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/ustawienia/konto">
              {hasPassword ? "Zmień hasło" : "Ustaw hasło"}
            </Link>
          </Button>
        </div>

        <div className={WIERSZ}>
          <div>
            <div className="flex items-center gap-2 font-medium">
              Sesja <StatusBadge tone="green">Aktywna</StatusBadge>
            </div>
            <div className="text-xs text-muted-foreground">
              {sessionLabel} · teraz
            </div>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              <LogOut size={16} aria-hidden="true" />
              Wyloguj
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
