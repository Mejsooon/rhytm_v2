import { Check } from "lucide-react";
import * as React from "react";

import { Segment, Stepper, TextField } from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  GOALS,
  formatKm,
  formatSleep,
  goalInRange,
  stepKm,
  stepSleep,
  stepWorkouts,
  toggleGoal,
  type GoalType,
  type OnboardingDraft,
} from "../model";

import { StepHeader } from "./step-header";

const RODZAJE_CELU: { value: GoalType; label: string }[] = [
  { value: "workouts", label: "Treningi / tydz." },
  { value: "km", label: "Km / tydz." },
];

// Krok 3: cele (OnboardingGoals + MOnboarding). Web: karty z polem po lewej, telefon: kafelki 2×N z polem po prawej.
export function StepGoals({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  const pokazCel = draft.goals.includes("sport");
  const pokazSen = draft.goals.includes("habits");

  // Cel treningowy: liczba wybranego rodzaju (druga zostaje w szkicu)
  const naKm = draft.goalType === "km";
  const wartosc = naKm ? draft.weeklyKm : draft.weeklyWorkouts;
  const etykietaCelu = naKm ? "Kilometry w tygodniu" : "Treningi w tygodniu";
  const bladCelu = goalInRange(draft.goalType, wartosc)
    ? undefined
    : naKm
      ? "Podaj liczbę 1–300."
      : "Podaj liczbę 1–14.";
  // Tekst wpisany w pole web (null = pokazujemy liczbę ze szkicu)
  const [tekstCelu, setTekstCelu] = React.useState<string | null>(null);
  const poleCelu = tekstCelu ?? (Number.isFinite(wartosc) ? formatKm(wartosc) : "");

  return (
    <>
      <StepHeader
        title="Co chcesz ogarnąć w rhytm?"
        subtitle="Na tej podstawie przygotujemy startowe strony i cele"
      />

      <div className="grid grid-cols-2 gap-2">
        {GOALS.map((cel) => {
          const wlaczony = draft.goals.includes(cel.key);
          return (
            <button
              key={cel.key}
              type="button"
              aria-pressed={wlaczony}
              onClick={() => onChange(toggleGoal(draft, cel.key))}
              className={cn(
                "box-border flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-[10px] border border-[#e0e0e0] bg-white px-3.5 py-3 text-left text-[#171717] transition-colors outline-none hover:border-[#a3a3a3] focus-visible:ring-2 focus-visible:ring-[#171717]/20 max-[799px]:flex-col-reverse max-[799px]:gap-1",
                wlaczony && "border-[#171717] shadow-[inset_0_0_0_1px_#171717] hover:border-[#171717]",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-px inline-flex size-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px] max-[799px]:hidden",
                  wlaczony
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-[#cfcfcf] bg-white text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={2} />
              </span>
              <span className="flex w-full flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{cel.title}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "hidden size-6 flex-none items-center justify-center rounded-[7px] border-[1.5px] max-[799px]:inline-flex",
                      wlaczony
                        ? "border-[#15803d] bg-[#15803d] text-white"
                        : "border-[#cfcfcf] bg-white text-transparent",
                    )}
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                </span>
                <span className="text-[13px] text-[#737373] max-[799px]:text-xs">{cel.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {pokazCel && (
        <div className="flex flex-col gap-1.5 text-[13px] font-medium max-[799px]:gap-2.5 max-[799px]:rounded-xl max-[799px]:border max-[799px]:border-[#eaeaea] max-[799px]:px-3.5 max-[799px]:py-3 max-[799px]:text-sm">
          {/* Telefon: etykieta mono jak .lbl w MOnboarding */}
          <span className="max-[799px]:font-mono max-[799px]:text-[11px] max-[799px]:font-normal max-[799px]:tracking-[0.06em] max-[799px]:text-[#6b6b6b] max-[799px]:uppercase">
            Cel treningowy
          </span>
          <div className="flex items-start gap-2 max-[799px]:flex-col max-[799px]:items-stretch max-[799px]:gap-2.5">
            <Segment
              ariaLabel="Rodzaj celu treningowego"
              value={draft.goalType}
              options={RODZAJE_CELU}
              onChange={(goalType) => {
                setTekstCelu(null);
                onChange({ ...draft, goalType });
              }}
            />
            {/* Web: jedno pole liczby (etykieta tylko dla czytników ekranu) */}
            <div className="min-w-0 flex-1 max-[799px]:hidden [&_label]:sr-only">
              <TextField
                label={etykietaCelu}
                type="text"
                inputMode="numeric"
                className="font-mono"
                value={poleCelu}
                error={bladCelu}
                onChange={(e) => {
                  const tekst = e.target.value;
                  setTekstCelu(tekst);
                  // Pusty tekst lub nieliczba → NaN, wtedy „Dalej” jest nieaktywne
                  const liczba = tekst.trim() === "" ? Number.NaN : Number(tekst.trim().replace(",", "."));
                  onChange(naKm ? { ...draft, weeklyKm: liczba } : { ...draft, weeklyWorkouts: liczba });
                }}
              />
            </div>
            {/* Telefon: licznik −/+ (treningi co 1 w 1–14, km co 5 w 5–150) */}
            <div className="flex min-h-11 items-center justify-between gap-3 min-[800px]:hidden">
              <span>{etykietaCelu}</span>
              <Stepper
                ariaLabel={etykietaCelu}
                value={naKm ? `${formatKm(draft.weeklyKm)} km` : String(draft.weeklyWorkouts)}
                onDec={() => {
                  setTekstCelu(null);
                  onChange(
                    naKm
                      ? { ...draft, weeklyKm: stepKm(draft.weeklyKm, -1) }
                      : { ...draft, weeklyWorkouts: stepWorkouts(draft.weeklyWorkouts, -1) },
                  );
                }}
                onInc={() => {
                  setTekstCelu(null);
                  onChange(
                    naKm
                      ? { ...draft, weeklyKm: stepKm(draft.weeklyKm, 1) }
                      : { ...draft, weeklyWorkouts: stepWorkouts(draft.weeklyWorkouts, 1) },
                  );
                }}
                decDisabled={naKm ? draft.weeklyKm <= 5 : draft.weeklyWorkouts <= 1}
                incDisabled={naKm ? draft.weeklyKm >= 150 : draft.weeklyWorkouts >= 14}
              />
            </div>
          </div>
        </div>
      )}
      {pokazSen && (
        <div className="flex items-center justify-between gap-3 text-[13px] font-medium max-[799px]:rounded-[14px] max-[799px]:border max-[799px]:border-[#e0e0e0] max-[799px]:px-4 max-[799px]:py-3 max-[799px]:text-sm">
          <span>Cel snu</span>
          <Stepper
            ariaLabel="Cel snu"
            value={formatSleep(draft.sleepGoalMin)}
            onDec={() => onChange({ ...draft, sleepGoalMin: stepSleep(draft.sleepGoalMin, -1) })}
            onInc={() => onChange({ ...draft, sleepGoalMin: stepSleep(draft.sleepGoalMin, 1) })}
            decDisabled={draft.sleepGoalMin <= 300}
            incDisabled={draft.sleepGoalMin >= 660}
          />
        </div>
      )}
    </>
  );
}
