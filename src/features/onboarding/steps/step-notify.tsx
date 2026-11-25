"use client";

import * as React from "react";
import { Bell, Check, Smartphone } from "lucide-react";

import { Button, Card, StatusBadge, Switch } from "@/components/controls";
import { cn } from "@/lib/utils";
import { REMINDERS, type OnboardingDraft } from "../model";
import { StepHeader } from "./step-header";

// Prosi przeglądarkę o zgodę na powiadomienia; brak API albo wyjątek nie przerywają kreatora
export async function requestBrowserPermission(): Promise<
  "granted" | "denied" | "unsupported"
> {
  if (
    typeof window === "undefined" ||
    typeof window.Notification === "undefined"
  ) {
    return "unsupported";
  }
  try {
    const wynik = await window.Notification.requestPermission();
    return wynik === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

// Krok 6: przypomnienia (OnboardingNotify + CMOnboarding).
export function StepNotify({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  const { notify } = draft;
  // Odmowa lub brak API: tekst zmienia się na „nie pozwoliła”, a „Zezwól” zostaje
  const [odmowa, setOdmowa] = React.useState(false);

  async function zezwol() {
    const wynik = await requestBrowserPermission();
    if (wynik === "granted") {
      setOdmowa(false);
      onChange({ ...draft, notify: { ...notify, perm: true } });
    } else {
      setOdmowa(true);
    }
  }

  function cofnij() {
    setOdmowa(false);
    onChange({ ...draft, notify: { ...notify, perm: false } });
  }

  const tekstWeb = notify.perm
    ? "Przeglądarka pozwoliła na powiadomienia"
    : odmowa
      ? "Przeglądarka nie pozwoliła na powiadomienia"
      : "Przeglądarka zapyta o zgodę";
  const tekstTelefon = notify.perm
    ? "Telefon pozwolił na powiadomienia"
    : odmowa
      ? "Telefon nie pozwolił na powiadomienia"
      : "Telefon zapyta o zgodę";

  return (
    <>
      <StepHeader
        title="Przypomnienia"
        subtitle="Wybierz, o czym mamy Ci przypominać. Ustawienia zmienisz w każdej chwili"
        phoneSubtitle="Wybierz, o czym mamy Ci przypominać. Ustawienia zmienisz w każdej chwili."
      />

      <div
        data-testid="notify-web"
        className="flex flex-col gap-5 max-[799px]:hidden"
      >
        <Card className="flex-row items-center gap-3 px-4 py-3.5">
          <span
            aria-hidden="true"
            className="grid size-8 flex-none place-items-center rounded-lg bg-muted"
          >
            <Bell className="size-4 text-soft-foreground" strokeWidth={2} />
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="font-medium">Powiadomienia w przeglądarce</span>
            <span className="text-[13px] text-muted-foreground">
              {tekstWeb}
            </span>
          </span>
          {notify.perm ? (
            <>
              <StatusBadge tone="green" size="lg">
                <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                Włączone
              </StatusBadge>
              <Button variant="ghost" size="sm" onClick={cofnij}>
                Anuluj
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => void zezwol()}>
              Zezwól
            </Button>
          )}
        </Card>

        <Card className="px-4">
          {REMINDERS.map((r) => (
            <div
              key={r.key}
              className="flex min-h-[58px] items-center gap-3 border-b border-border last:border-b-0"
            >
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{r.title}</span>
                <span className="text-[13px] text-muted-foreground">
                  {r.when}
                </span>
              </span>
              <Switch
                checked={notify[r.key]}
                ariaLabel={r.title}
                onChange={(v) =>
                  onChange({ ...draft, notify: { ...notify, [r.key]: v } })
                }
              />
            </div>
          ))}
        </Card>

        {/* Niebieska informacja (.alert.info): tokeny info */}
        <div className="flex items-start gap-2.5 rounded-lg border border-info-border bg-info/[.04] px-3.5 py-3 text-sm">
          <Smartphone
            aria-hidden="true"
            className="mt-0.5 size-4 flex-none text-info"
            strokeWidth={2}
          />
          <span>
            Na telefonie dodaj rhytm do ekranu głównego, żeby dostawać push
            także przy zamkniętej karcie
          </span>
        </div>
      </div>

      <div
        data-testid="notify-phone"
        className="flex flex-col gap-4 min-[800px]:hidden"
      >
        {/* Karta zgody: kafelek 40 px z dzwonkiem, podpis i przycisk „Zezwól” albo plakietka „Włączone” */}
        <Card className="flex-row items-center gap-3 p-3.5">
          <span className="flex size-10 flex-none items-center justify-center rounded-md bg-black/[.05]">
            <Bell
              aria-hidden="true"
              className="size-[19px] text-foreground"
              strokeWidth={2}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Powiadomienia</span>
            <span className="text-xs text-muted-foreground">
              {tekstTelefon}
            </span>
          </span>
          {notify.perm ? (
            <span className="flex flex-col items-end">
              <StatusBadge tone="green">Włączone</StatusBadge>
              <Button
                variant="ghost"
                size="sm"
                onClick={cofnij}
                className="text-muted-foreground underline"
              >
                Anuluj
              </Button>
            </span>
          ) : (
            <Button variant="primary" onClick={() => void zezwol()}>
              Zezwól
            </Button>
          )}
        </Card>

        {/* Lista przypomnień: wiersze `m-row`, bez zgody przyciemnione */}
        <Card className="gap-0 overflow-hidden">
          {REMINDERS.map((r) => (
            <div
              key={r.key}
              data-reminder-row
              className={cn("m-row min-h-14", !notify.perm && "opacity-[.55]")}
            >
              <span className="min-w-0 flex-1">
                <span className="block">{r.title}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {r.when}
                </span>
              </span>
              <Switch
                checked={notify[r.key]}
                ariaLabel={r.title}
                onChange={(v) =>
                  onChange({ ...draft, notify: { ...notify, [r.key]: v } })
                }
              />
            </div>
          ))}
        </Card>

        <p className="m-0 text-xs leading-normal text-muted-foreground">
          Dodaj rhytm do ekranu głównego, żeby dostawać push także przy
          zamkniętej aplikacji.
        </p>
      </div>
    </>
  );
}
