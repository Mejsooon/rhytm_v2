"use client";

// Krok 2: „Do czego użyjesz rhytm?” — pigułki i cele na tydzień dla wybranych (S2OnboardingFlow).
import * as React from "react";

import { FIELD } from "@/components/controls";
import { cn } from "@/lib/utils";
import { kmOk, sleepOk, USE_GROUPS, workoutsOk, type OnboardingDraft, type UseKey } from "../model";
import { StepHeader } from "./step-header";

const PIGULKA =
  "inline-flex h-[34px] cursor-pointer items-center rounded-full border border-input bg-white px-3.5 text-sm whitespace-nowrap text-foreground outline-none hover:bg-accent focus-visible:shadow-focus aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground max-[799px]:h-11";

// „7,5” → 7.5; pusty albo zły → NaN
const liczba = (t: string) => (t.trim() === "" ? Number.NaN : Number(t.trim().replace(",", ".")));
const tekstLiczby = (n: number) => (Number.isFinite(n) ? String(n).replace(".", ",") : "");

function Cel({
  nazwa,
  jednostka,
  poczatek,
  zly,
  komunikat,
  onWpis,
}: {
  nazwa: string;
  jednostka: string;
  poczatek: string;
  zly: boolean;
  komunikat: string;
  onWpis: (t: string) => void;
}) {
  const [tekst, setTekst] = React.useState(poczatek);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24">{nazwa}</span>
      <input
        value={tekst}
        inputMode="decimal"
        aria-label={nazwa}
        aria-invalid={zly || undefined}
        onChange={(e) => {
          setTekst(e.target.value);
          onWpis(e.target.value);
        }}
        className={cn(FIELD, "w-16 text-center tabular-nums")}
      />
      <span className="text-xs text-muted-foreground">{jednostka}</span>
      {zly && <span className="text-xs text-destructive-foreground">{komunikat}</span>}
    </div>
  );
}

export function StepUses({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  const { uses } = draft;
  const przelacz = (k: UseKey) =>
    onChange({ ...draft, uses: uses.includes(k) ? uses.filter((u) => u !== k) : [...uses, k] });
  const cele = uses.includes("run") || uses.includes("gym") || uses.includes("sleep");

  return (
    <>
      <StepHeader
        title="Do czego użyjesz rhytm?"
        subtitle="Zaznacz wszystko, co pasuje. Ułożymy z tego kategorie, moduły i strony."
      />
      {USE_GROUPS.map((g) => (
        <div key={g.title} role="group" aria-label={g.title}>
          <div className="mb-2 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">{g.title}</div>
          <div className="flex flex-wrap gap-2">
            {g.items.map(([k, etykieta]) => (
              <button key={k} type="button" aria-pressed={uses.includes(k)} onClick={() => przelacz(k)} className={PIGULKA}>
                {etykieta}
              </button>
            ))}
          </div>
        </div>
      ))}

      {cele && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border p-4">
          <span className="font-medium">
            Cele na tydzień <span className="text-xs font-normal text-muted-foreground">· zmienisz je w każdej chwili</span>
          </span>
          {uses.includes("run") && (
            <Cel
              nazwa="Bieganie"
              jednostka="km"
              poczatek={tekstLiczby(draft.weeklyKm)}
              zly={!kmOk(draft.weeklyKm)}
              komunikat="Podaj liczbę 1–300."
              onWpis={(t) => onChange({ ...draft, weeklyKm: liczba(t) })}
            />
          )}
          {uses.includes("gym") && (
            <Cel
              nazwa="Siłownia"
              jednostka="treningi"
              poczatek={tekstLiczby(draft.weeklyWorkouts)}
              zly={!workoutsOk(draft.weeklyWorkouts)}
              komunikat="Podaj liczbę 1–14."
              onWpis={(t) => onChange({ ...draft, weeklyWorkouts: liczba(t) })}
            />
          )}
          {uses.includes("sleep") && (
            <Cel
              nazwa="Sen"
              jednostka="h na noc"
              poczatek={tekstLiczby(draft.sleepGoalMin / 60)}
              zly={!sleepOk(draft.sleepGoalMin)}
              komunikat="Od 5 do 11 h, co kwadrans."
              onWpis={(t) => onChange({ ...draft, sleepGoalMin: liczba(t) * 60 })}
            />
          )}
        </div>
      )}
    </>
  );
}
