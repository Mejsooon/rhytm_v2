"use client";

// Krok 4: przypomnienia i opcjonalne „Skąd o nas wiesz?” (S2OnboardingFlow).
import * as React from "react";

import { Button, Card, StatusBadge, Switch } from "@/components/controls";
import { REMINDERS, SOURCES, type OnboardingDraft } from "../model";
import { StepHeader } from "./step-header";

// Prosi przeglądarkę o zgodę na powiadomienia; brak API albo wyjątek nie przerywają kreatora
export async function requestBrowserPermission(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") return "unsupported";
  try {
    const wynik = await window.Notification.requestPermission();
    return wynik === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export function StepReminders({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  const { notify } = draft;
  const [odmowa, setOdmowa] = React.useState(false);

  async function zezwol() {
    const wynik = await requestBrowserPermission();
    setOdmowa(wynik !== "granted");
    if (wynik === "granted") onChange({ ...draft, notify: { ...notify, perm: true } });
  }

  return (
    <>
      <StepHeader title="Przypomnienia" subtitle="Damy znać przed blokiem — nie musisz pilnować zegarka." />

      <Card className="flex-row items-center gap-3 px-4 py-3.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">Powiadomienia w przeglądarce</span>
          <span className="text-[13px] text-muted-foreground">
            {notify.perm
              ? "Przeglądarka pozwoliła na powiadomienia"
              : odmowa
                ? "Przeglądarka nie pozwoliła na powiadomienia"
                : "Przeglądarka zapyta o zgodę"}
          </span>
        </span>
        {notify.perm ? (
          <StatusBadge tone="green" size="lg">
            Włączone
          </StatusBadge>
        ) : (
          <Button variant="primary" size="sm" onClick={() => void zezwol()}>
            Zezwól
          </Button>
        )}
      </Card>

      <Card className="gap-0 px-4">
        {REMINDERS.map((r) => (
          <div key={r.key} className="flex min-h-14 items-center gap-3 border-b border-border last:border-b-0">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-medium">{r.title}</span>
              <span className="text-[13px] text-muted-foreground">{r.when}</span>
            </span>
            <Switch
              checked={notify[r.key]}
              ariaLabel={r.title}
              onChange={(v) => onChange({ ...draft, notify: { ...notify, [r.key]: v } })}
            />
          </div>
        ))}
      </Card>

      <div role="group" aria-label="Skąd o nas wiesz?">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="font-medium">Skąd o nas wiesz?</span>
          <span className="text-xs text-muted-foreground">opcjonalnie · jedno kliknięcie</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map(([k, etykieta]) => (
            <button
              key={k}
              type="button"
              aria-pressed={draft.source === k}
              onClick={() => onChange({ ...draft, source: draft.source === k ? null : k })}
              className="inline-flex h-[30px] cursor-pointer items-center rounded-full border border-input bg-white px-3 text-[13px] text-foreground outline-none hover:bg-accent focus-visible:shadow-focus aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground max-[799px]:h-11"
            >
              {etykieta}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
