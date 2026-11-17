import { Check } from "lucide-react";

import { Stepper } from "@/components/controls";
import { cn } from "@/lib/utils";
import { GOALS, formatSleep, stepKm, stepSleep, toggleGoal, type OnboardingDraft } from "../model";
import { StepHeader } from "./step-header";

// Krok 3: cele (OnboardingGoals + MOnboarding). Web: karty z polem po lewej, telefon: kafelki 2×N z polem po prawej.
export function StepGoals({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  const pokazKm = draft.goals.includes("sport");
  const pokazSen = draft.goals.includes("habits");

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

      {pokazKm && (
        <div className="flex items-center justify-between gap-3 text-[13px] font-medium max-[799px]:rounded-[14px] max-[799px]:border max-[799px]:border-[#e0e0e0] max-[799px]:px-4 max-[799px]:py-3 max-[799px]:text-sm">
          <span>Kilometry w tygodniu</span>
          <Stepper
            ariaLabel="Kilometry w tygodniu"
            value={`${draft.weeklyKm} km`}
            onDec={() => onChange({ ...draft, weeklyKm: stepKm(draft.weeklyKm, -1) })}
            onInc={() => onChange({ ...draft, weeklyKm: stepKm(draft.weeklyKm, 1) })}
            decDisabled={draft.weeklyKm <= 5}
            incDisabled={draft.weeklyKm >= 150}
          />
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
