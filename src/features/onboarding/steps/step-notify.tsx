"use client";

import * as React from "react";
import { Bell, Check, Smartphone } from "lucide-react";

import { Button, StatusBadge, Switch } from "@/components/controls";
import { cn } from "@/lib/utils";
import { REMINDERS, type OnboardingDraft } from "../model";
import { StepHeader } from "./step-header";

// Prosi przeglądarkę o zgodę na powiadomienia; brak API albo wyjątek nie przerywają kreatora
export async function requestBrowserPermission(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return "unsupported";
  }
  try {
    const wynik = await window.Notification.requestPermission();
    return wynik === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

// Krok 6: przypomnienia (OnboardingNotify + MOnboarding).
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
      <div className="max-[799px]:hidden">
        <StepHeader
          title="Przypomnienia"
          subtitle="Wybierz, o czym mamy Ci przypominać. Ustawienia zmienisz w każdej chwili"
        />
      </div>
      <div className="min-[800px]:hidden">
        <StepHeader
          title="Przypomnienia"
          subtitle="Wybierz, o czym mamy Ci przypominać. Ustawienia zmienisz w każdej chwili."
        />
      </div>

      <div data-testid="notify-web" className="flex flex-col gap-5 max-[799px]:hidden">
        <div className="flex items-center gap-3 rounded-[10px] border border-[#e0e0e0] p-3.5">
          <Bell aria-hidden="true" className="size-[18px] flex-none text-[#525252]" strokeWidth={1.5} />
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="font-medium">Powiadomienia w przeglądarce</span>
            <span className="text-[13px] text-[#737373]">{tekstWeb}</span>
          </span>
          {notify.perm ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#15803d]">
                <Check aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
                Włączone
              </span>
              <Button variant="secondary" onClick={cofnij} className="ml-1 h-8 px-3 py-0 text-[13px]">
                Anuluj
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => void zezwol()} className="h-9 py-0">
              Zezwól
            </Button>
          )}
        </div>

        <div className="flex flex-col border-t border-[#f0f0f0]">
          {REMINDERS.map((r) => (
            <div
              key={r.key}
              className="flex min-h-14 items-center gap-3 border-b border-[#f0f0f0]"
            >
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{r.title}</span>
                <span className="text-[13px] text-[#737373]">{r.when}</span>
              </span>
              <Switch
                checked={notify[r.key]}
                ariaLabel={r.title}
                onChange={(v) => onChange({ ...draft, notify: { ...notify, [r.key]: v } })}
              />
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-[#fafafa] px-3 py-2.5 text-[13px] text-[#525252]">
          <Smartphone aria-hidden="true" className="size-4 flex-none text-[#737373]" strokeWidth={1.5} />
          <span>
            Na telefonie dodaj rhytm do ekranu głównego, żeby dostawać push także przy zamkniętej karcie
          </span>
        </div>
      </div>

      <div data-testid="notify-phone" className="flex flex-col gap-4 min-[800px]:hidden">
        <div className="flex items-center gap-3 rounded-xl border border-[#eaeaea] bg-white p-3.5">
          <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-[#f5f5f5]">
            <Bell aria-hidden="true" className="size-[19px] text-[#404040]" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Powiadomienia</span>
            <span className="text-xs text-[#666666]">{tekstTelefon}</span>
          </span>
          {notify.perm ? (
            <span className="flex flex-col items-end gap-0.5">
              <StatusBadge tone="green">Włączone</StatusBadge>
              <button
                type="button"
                onClick={cofnij}
                className="min-h-11 cursor-pointer border-0 bg-transparent px-1 text-xs text-[#666666] underline"
              >
                Anuluj
              </button>
            </span>
          ) : (
            <Button variant="primary" onClick={() => void zezwol()} className="h-11 w-auto px-3.5 py-0">
              Zezwól
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-[#eaeaea] bg-white">
          {REMINDERS.map((r) => (
            <div
              key={r.key}
              data-reminder-row
              className={cn(
                "flex min-h-[52px] items-center gap-3 border-b border-[#f0f0f0] px-3.5 last:border-b-0",
                !notify.perm && "opacity-[.55]",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block">{r.title}</span>
                <span className="font-mono text-xs text-[#6b6b6b]">{r.when}</span>
              </span>
              <Switch
                checked={notify[r.key]}
                ariaLabel={r.title}
                onChange={(v) => onChange({ ...draft, notify: { ...notify, [r.key]: v } })}
              />
            </div>
          ))}
        </div>

        <p className="m-0 text-xs leading-normal text-[#666666]">
          Dodaj rhytm do ekranu głównego, żeby dostawać push także przy zamkniętej aplikacji.
        </p>
      </div>
    </>
  );
}
