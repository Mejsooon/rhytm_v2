"use client";

// „Wyślij opinię” / „Zgłoś błąd” wg S2Help.
import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Button, Checkbox, FIELD, FormDialog, Segment } from "@/components/controls";
import { cn } from "@/lib/utils";
import { sendFeedback, type FeedbackInput } from "./actions";
import { WERSJA } from "./version";

export type FeedbackKind = FeedbackInput["kind"];

// Teksty z makiety bez form rodzajowych
const POLE: Record<FeedbackKind, { etykieta: string; ph: string }> = {
  idea: { etykieta: "Co by Ci pomogło?", ph: "Np. widok tablicy w Projektach…" },
  bug: { etykieta: "Co się stało?", ph: "Co zostało kliknięte, co miało się stać i co się stało?" },
  other: { etykieta: "Wiadomość", ph: "Napisz, o co chodzi…" },
};

const EKRANY: Record<string, string> = {
  dzis: "Dziś",
  kalendarz: "Kalendarz",
  sport: "Sport",
  nawyki: "Nawyki i sen",
  strony: "Strony",
  hasla: "Hasła",
  szukaj: "Szukaj",
  ustawienia: "Ustawienia",
};

function przegladarka(ua: string): string {
  const nazwa = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "inna";
  const system = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "inny system";
  return `${nazwa} · ${system}`;
}

export function FeedbackDialog({
  kind: startowy,
  code,
  email,
  onClose,
}: {
  kind: FeedbackKind;
  // Kod błędu z ekranu 500
  code?: string;
  email?: string;
  onClose: () => void;
}) {
  const sciezka = usePathname() ?? "";
  const [kind, setKind] = React.useState<FeedbackKind>(startowy);
  const [tekst, setTekst] = React.useState("");
  const [kontakt, setKontakt] = React.useState(true);
  const [wysylanie, setWysylanie] = React.useState(false);
  const [wyslane, setWyslane] = React.useState(false);
  const ekran = EKRANY[sciezka.split("/")[1] ?? ""] ?? sciezka;

  async function wyslij() {
    setWysylanie(true);
    const wynik = await sendFeedback({
      kind,
      message: tekst,
      contact: kontakt,
      context:
        kind === "bug"
          ? { screen: ekran, browser: przegladarka(navigator.userAgent), version: WERSJA, ...(code ? { code } : {}) }
          : {},
    }).catch(() => null);
    setWysylanie(false);
    // Przy błędzie treść zostaje w formularzu
    if (wynik?.ok) setWyslane(true);
    else toast.error(wynik?.message ?? "Nie udało się wysłać. Spróbuj ponownie.");
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={wyslane ? "Dzięki, dostaliśmy to" : "Wyślij opinię"}
      description={
        wyslane ? `Jeśli kontakt był zaznaczony, odpiszemy na ${email ?? "adres Twojego konta"}.` : "Czytamy każdą."
      }
      descriptionClassName="max-[799px]:block"
      footer={
        wyslane ? (
          <Button variant="primary" onClick={onClose}>
            Gotowe
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Anuluj</Button>
            <Button variant="primary" disabled={tekst.trim() === "" || wysylanie} onClick={() => void wyslij()}>
              Wyślij
            </Button>
          </>
        )
      }
    >
      {!wyslane && (
        <>
          <Segment
            ariaLabel="Rodzaj zgłoszenia"
            value={kind}
            onChange={setKind}
            options={[
              { value: "idea", label: "Pomysł" },
              { value: "bug", label: "Błąd" },
              { value: "other", label: "Inne" },
            ]}
          />
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            {POLE[kind].etykieta}
            <textarea
              value={tekst}
              maxLength={4000}
              onChange={(e) => setTekst(e.target.value)}
              placeholder={POLE[kind].ph}
              className={cn(FIELD, "h-auto min-h-[120px] resize-y py-2.5 leading-normal max-[799px]:h-auto")}
            />
          </label>
          {kind === "bug" && (
            <p className="m-0 text-xs text-muted-foreground">
              Dołączymy automatycznie: ekran „{ekran}”, przeglądarkę i wersję aplikacji
              {code ? ` oraz kod ${code}` : ""}.
            </p>
          )}
          <Checkbox checked={kontakt} onChange={setKontakt} label="Możecie do mnie napisać w tej sprawie" />
        </>
      )}
    </FormDialog>
  );
}
