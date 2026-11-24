"use client";

// Karta „Sesje” (Ustawienia → Konto i bezpieczeństwo, S2SettingsAccount.dc.html):
// bieżąca sesja z plakietką „Aktualna”, inne z „Wyloguj”, w nagłówku „Wyloguj wszystkie inne”.
import * as React from "react";
import { Check, Monitor, Smartphone, X } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusBadge,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { revokeSession, signOutOtherSessions } from "./account-actions";

export type SessionItem = {
  id: string;
  label: string;
  mobile: boolean;
  lastActiveAt: string;
  current: boolean;
};

// Wiersz listy (.nrow): 14 px w pionie, linia rgba(0,0,0,.06) między wierszami
const WIERSZ =
  "flex flex-wrap items-center justify-between gap-3 border-b border-black/[.06] py-3.5";

export function SessionsCard({
  sessions,
  loadError,
  currentLabel,
  currentMobile,
  timeZone,
}: {
  sessions: SessionItem[];
  loadError: boolean;
  currentLabel: string;
  currentMobile: boolean;
  timeZone: string;
}) {
  // Sesje wylogowane w tej wizycie (zanim serwer odświeży listę)
  const [usuniete, setUsuniete] = React.useState<string[]>([]);
  const [wszystkieInne, setWszystkieInne] = React.useState(false);
  const [komunikat, setKomunikat] = React.useState<{
    ok: boolean;
    tekst: string;
  } | null>(null);
  const [pracuje, setPracuje] = React.useState(false);

  // Bieżąca: z listy z bazy, a gdy jej tam nie ma (błąd odczytu) — z nagłówka user-agent
  const biezaca = sessions.find((s) => s.current) ?? {
    id: "biezaca",
    label: currentLabel,
    mobile: currentMobile,
    lastActiveAt: "",
    current: true,
  };
  const inne = wszystkieInne
    ? []
    : sessions.filter((s) => !s.current && !usuniete.includes(s.id));
  // Lista bez bieżącej (JWT bez session_id): nie wiadomo, który wiersz to ta przeglądarka,
  // więc żaden wiersz nie dostaje „Wyloguj” (baza i tak odmówi: brak_sesji)
  const bezRozpoznania =
    sessions.length > 0 && !sessions.some((s) => s.current);
  // Przy błędzie odczytu nie wiemy, czy są inne sesje — przycisk zostaje aktywny
  const brakInnych = inne.length === 0 && (!loadError || wszystkieInne);

  // Odmiana: 1 aktywna sesja, 2–4 aktywne sesje (bez 12–14), reszta aktywnych sesji.
  // Bez rozpoznania bieżąca jest jednym z wierszy listy — nie liczymy jej drugi raz
  const n = bezRozpoznania ? Math.max(1, inne.length) : inne.length + 1;
  const liczba =
    n === 1
      ? "1 aktywna sesja"
      : `${n}${
          n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
            ? " aktywne sesje"
            : " aktywnych sesji"
        }`;

  // Ostatnia aktywność w strefie z profilu: „dziś 08:02”, „wczoraj 21:14”, „12.11 08:02”
  const dzien = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const godzina = new Intl.DateTimeFormat("pl-PL", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const dzis = dzien.format(new Date());
  const [r, m, d] = dzis.split("-").map(Number);
  const wczoraj = new Date(Date.UTC(r, m - 1, d - 1))
    .toISOString()
    .slice(0, 10);

  async function wylogujWszystkie() {
    if (brakInnych || pracuje) return;
    setPracuje(true);
    try {
      const wynik = await signOutOtherSessions();
      if (wynik.ok) {
        setWszystkieInne(true);
        setKomunikat({
          ok: true,
          tekst: "Wylogowano wszystkie inne urządzenia ✓",
        });
      } else {
        setKomunikat({
          ok: false,
          tekst: "Nie udało się wylogować innych sesji. Spróbuj ponownie.",
        });
      }
    } catch {
      setKomunikat({
        ok: false,
        tekst: "Nie udało się wylogować innych sesji. Spróbuj ponownie.",
      });
    } finally {
      setPracuje(false);
    }
  }

  async function wyloguj(sesja: SessionItem) {
    if (pracuje) return;
    setPracuje(true);
    try {
      const wynik = await revokeSession(sesja.id);
      if (wynik.ok) {
        setUsuniete((u) => [...u, sesja.id]);
        setKomunikat({ ok: true, tekst: `Wylogowano: ${sesja.label}` });
      } else {
        // Wygasła sesja i tak znika z listy
        if (wynik.message === "Ta sesja już wygasła.")
          setUsuniete((u) => [...u, sesja.id]);
        setKomunikat({ ok: false, tekst: wynik.message });
      }
    } catch {
      setKomunikat({
        ok: false,
        tekst: "Nie udało się wylogować sesji. Spróbuj ponownie.",
      });
    } finally {
      setPracuje(false);
    }
  }

  return (
    <Card data-testid="karta-sesje">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle as="h2">Sesje</CardTitle>
          <CardDescription>{liczba}</CardDescription>
        </div>
        <Button
          size="sm"
          aria-disabled={brakInnych || pracuje}
          className="aria-disabled:pointer-events-none aria-disabled:opacity-[.45]"
          onClick={() => void wylogujWszystkie()}
        >
          Wyloguj wszystkie inne
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={WIERSZ}>
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]">
              {biezaca.mobile ? (
                <Smartphone size={16} aria-hidden="true" />
              ) : (
                <Monitor size={16} aria-hidden="true" />
              )}
            </span>
            <div>
              <div className="font-medium">{biezaca.label}</div>
              <div className="text-[13px] text-muted-foreground">
                teraz · ta sesja
              </div>
            </div>
          </div>
          <StatusBadge tone="green">Aktualna</StatusBadge>
        </div>
        {inne.map((s) => {
          const kiedy = new Date(s.lastActiveAt);
          let podpis = "";
          if (!Number.isNaN(kiedy.getTime())) {
            const dzienSesji = dzien.format(kiedy);
            const hh = godzina.format(kiedy);
            if (dzienSesji === dzis) podpis = `dziś ${hh}`;
            else if (dzienSesji === wczoraj) podpis = `wczoraj ${hh}`;
            else
              podpis = `${dzienSesji.slice(8, 10)}.${dzienSesji.slice(5, 7)} ${hh}`;
          }
          return (
            <div key={s.id} className={WIERSZ}>
              <div className="flex items-center gap-3">
                <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]">
                  {s.mobile ? (
                    <Smartphone size={16} aria-hidden="true" />
                  ) : (
                    <Monitor size={16} aria-hidden="true" />
                  )}
                </span>
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-[13px] text-muted-foreground">
                    {podpis}
                  </div>
                </div>
              </div>
              {!bezRozpoznania && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Wyloguj: ${s.label}`}
                  aria-disabled={pracuje}
                  onClick={() => void wyloguj(s)}
                >
                  Wyloguj
                </Button>
              )}
            </div>
          );
        })}
        {loadError && (
          <p className="m-0 pt-3.5 text-[13px] text-destructive-foreground">
            Nie udało się wczytać listy sesji.
          </p>
        )}
        <p className="m-0 pt-3.5 pb-1 text-[13px] text-muted-foreground">
          „Wyloguj wszystkie inne” kończy sesje na wszystkich pozostałych
          urządzeniach i przeglądarkach. Tu zostaniesz zalogowany.
        </p>
      </CardContent>
      {komunikat && (
        <CardContent className="pt-0">
          <div
            role="status"
            className={cn(
              "flex items-start gap-2.5 rounded-[12px] border px-3.5 py-3 text-[13px]",
              komunikat.ok
                ? "border-success-border bg-success/[.04]"
                : "border-destructive/[.24] bg-destructive/[.04]",
            )}
          >
            {komunikat.ok ? (
              <Check size={16} aria-hidden="true" className="flex-none" />
            ) : (
              <X size={16} aria-hidden="true" className="flex-none" />
            )}
            <span>{komunikat.tekst}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
