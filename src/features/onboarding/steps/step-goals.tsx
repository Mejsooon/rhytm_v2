import { Check } from "lucide-react";
import * as React from "react";

import { Stepper, TextField } from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  formatKm,
  formatSleep,
  goalInRange,
  stepKm,
  stepSleep,
  stepWorkouts,
  type OnboardingDraft,
} from "../model";

import { StepHeader } from "./step-header";

// Krok 3: cele (OnboardingGoals + CMOnboarding): tylko cele treningowe i cel snu, bez kafelków modułów.
export function StepGoals({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  // Teksty wpisane w pola web (null = pokazujemy liczbę ze szkicu)
  const [tekstTreningow, setTekstTreningow] = React.useState<string | null>(
    null,
  );
  const [tekstKm, setTekstKm] = React.useState<string | null>(null);
  const brakCelu = !draft.workoutsOn && !draft.kmOn;

  // Dwa cele treningowe (OnboardingGoals: kolumny z polem; CMOnboarding: wiersze z licznikiem `m-step`)
  const celeTreningowe = [
    {
      key: "workouts",
      label: "Treningi w tygodniu",
      on: draft.workoutsOn,
      pole:
        tekstTreningow ??
        (Number.isFinite(draft.weeklyWorkouts)
          ? String(draft.weeklyWorkouts)
          : ""),
      blad: goalInRange("workouts", draft.weeklyWorkouts)
        ? undefined
        : "Podaj liczbę 1–14.",
      licznik: String(draft.weeklyWorkouts),
      decDisabled: draft.weeklyWorkouts <= 1,
      incDisabled: draft.weeklyWorkouts >= 14,
      przelacz: () => {
        setTekstTreningow(null);
        // Wyłączony cel ze złą liczbą wraca do 3, żeby nie blokował „Dalej”
        onChange({
          ...draft,
          workoutsOn: !draft.workoutsOn,
          weeklyWorkouts: goalInRange("workouts", draft.weeklyWorkouts)
            ? draft.weeklyWorkouts
            : 3,
        });
      },
      wpisz: (tekst: string) => {
        setTekstTreningow(tekst);
        // Pusty tekst lub nieliczba → NaN, wtedy „Dalej” jest nieaktywne
        onChange({
          ...draft,
          weeklyWorkouts:
            tekst.trim() === ""
              ? Number.NaN
              : Number(tekst.trim().replace(",", ".")),
        });
      },
      krok: (dir: -1 | 1) => {
        setTekstTreningow(null);
        onChange({
          ...draft,
          weeklyWorkouts: stepWorkouts(draft.weeklyWorkouts, dir),
        });
      },
    },
    {
      key: "km",
      label: "Kilometry biegu w tygodniu",
      on: draft.kmOn,
      pole:
        tekstKm ??
        (Number.isFinite(draft.weeklyKm) ? formatKm(draft.weeklyKm) : ""),
      blad: goalInRange("km", draft.weeklyKm)
        ? undefined
        : "Podaj liczbę 1–300.",
      licznik: `${formatKm(draft.weeklyKm)} km`,
      decDisabled: draft.weeklyKm <= 5,
      incDisabled: draft.weeklyKm >= 150,
      przelacz: () => {
        setTekstKm(null);
        onChange({
          ...draft,
          kmOn: !draft.kmOn,
          weeklyKm: goalInRange("km", draft.weeklyKm) ? draft.weeklyKm : 25,
        });
      },
      wpisz: (tekst: string) => {
        setTekstKm(tekst);
        onChange({
          ...draft,
          weeklyKm:
            tekst.trim() === ""
              ? Number.NaN
              : Number(tekst.trim().replace(",", ".")),
        });
      },
      krok: (dir: -1 | 1) => {
        setTekstKm(null);
        onChange({ ...draft, weeklyKm: stepKm(draft.weeklyKm, dir) });
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="Twoje cele"
        subtitle="Zmienisz je później w Ustawieniach."
      />
      <p className="m-0 text-[13px] text-muted-foreground">
        <span className="max-[799px]:hidden">
          <span className="font-medium text-foreground">Zawsze masz:</span> Plan
          tygodnia · Treningi · Nawyki i sen · Hasła
        </span>
        {/* Telefon (CMOnboarding): zawsze włączone moduły i notka o haśle głównym sejfu */}
        <span className="min-[800px]:hidden">
          Plan tygodnia, treningi, nawyki i sen oraz Hasła są zawsze włączone.
          Hasło główne sejfu ustawisz przy pierwszym otwarciu Haseł.
        </span>
      </p>

      {/* Telefon: karta (padding 12/14/4) z etykietą `.lbl` i wierszami 60 px */}
      <div className="flex flex-col gap-2 text-[13px] font-medium max-[799px]:gap-0 max-[799px]:rounded-xl max-[799px]:border max-[799px]:border-border max-[799px]:bg-white max-[799px]:px-3.5 max-[799px]:pt-3 max-[799px]:pb-1 max-[799px]:text-sm max-[799px]:shadow-card">
        {/* Web: etykieta z podpowiedzią (hint 12 px); telefon: `.lbl` 12 px / 500 muted */}
        <span className="max-[799px]:text-xs max-[799px]:text-muted-foreground">
          Cele treningowe{" "}
          <span className="text-xs font-normal text-muted-foreground">
            · włącz jeden albo oba
          </span>
        </span>
        <div className="grid grid-cols-2 gap-3 max-[799px]:grid-cols-1 max-[799px]:gap-0">
          {celeTreningowe.map((cel, i) => (
            <div
              key={cel.key}
              className={cn(
                "flex flex-col gap-2 max-[799px]:min-h-[60px] max-[799px]:flex-row max-[799px]:items-center max-[799px]:gap-3",
                i > 0 && "max-[799px]:border-t max-[799px]:border-border-soft",
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={cel.on}
                onClick={cel.przelacz}
                className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-sm font-normal text-foreground outline-none focus-visible:shadow-focus max-[799px]:min-w-0 max-[799px]:flex-1 max-[799px]:gap-3"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "max-[799px]:m-hit inline-flex size-4 flex-none items-center justify-center rounded-[4px] border shadow-xs",
                    cel.on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-white text-transparent",
                  )}
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {cel.label}
              </button>
              {/* Web: pole liczby (etykieta tylko dla czytników ekranu); wyłączony cel ma puste, nieaktywne pole */}
              <div className="min-w-0 max-[799px]:hidden [&_label]:sr-only">
                <TextField
                  label={cel.label}
                  type="text"
                  inputMode="numeric"
                  className="tabular-nums disabled:bg-panel"
                  disabled={!cel.on}
                  value={cel.on ? cel.pole : "—"}
                  error={cel.on ? cel.blad : undefined}
                  onChange={(e) => cel.wpisz(e.target.value)}
                />
              </div>
              {/* Telefon: licznik −/+ albo „wyłączony” */}
              <div className="min-[800px]:hidden">
                {cel.on ? (
                  <Stepper
                    mono={false}
                    ariaLabel={cel.label}
                    value={cel.licznik}
                    onDec={() => cel.krok(-1)}
                    onInc={() => cel.krok(1)}
                    decDisabled={cel.decDisabled}
                    incDisabled={cel.incDisabled}
                  />
                ) : (
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    wyłączony
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {brakCelu && (
          <p
            role="alert"
            className="m-0 text-[13px] font-normal text-destructive-foreground max-[799px]:pb-2.5"
          >
            Włącz co najmniej jeden cel.
          </p>
        )}
      </div>
      {/* Web: etykieta nad licznikiem na połowie kolumny (.fld z max-width 50%); telefon: karta z wierszem (jak `m-row`) */}
      <div className="flex flex-col gap-2 text-[13px] font-medium max-[799px]:min-h-12 max-[799px]:flex-row max-[799px]:items-center max-[799px]:justify-between max-[799px]:gap-3 max-[799px]:rounded-xl max-[799px]:border max-[799px]:border-border max-[799px]:bg-white max-[799px]:px-4 max-[799px]:text-sm max-[799px]:font-normal max-[799px]:shadow-card">
        <span>Cel snu</span>
        <div className="min-[800px]:w-1/2">
          <Stepper
            wide="web"
            ariaLabel="Cel snu"
            value={formatSleep(draft.sleepGoalMin)}
            onDec={() =>
              onChange({
                ...draft,
                sleepGoalMin: stepSleep(draft.sleepGoalMin, -1),
              })
            }
            onInc={() =>
              onChange({
                ...draft,
                sleepGoalMin: stepSleep(draft.sleepGoalMin, 1),
              })
            }
            decDisabled={draft.sleepGoalMin <= 300}
            incDisabled={draft.sleepGoalMin >= 660}
          />
        </div>
      </div>
    </div>
  );
}
