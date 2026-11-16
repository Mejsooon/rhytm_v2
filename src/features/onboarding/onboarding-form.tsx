"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/controls/button";

import { ukonczOnboarding, type OnboardingState } from "./actions";

const POCZATKOWY: OnboardingState = { status: "idle" };

function Dalej() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      Dalej
    </Button>
  );
}

// Tymczasowy formularz onboardingu (etap 1 zastąpi go 7 krokami). Błąd zapisu pokazujemy pod przyciskiem.
export function OnboardingForm() {
  const [state, formAction] = useActionState(ukonczOnboarding, POCZATKOWY);
  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      <Dalej />
      {state.status === "error" && state.message && (
        <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
          {state.message}
        </p>
      )}
    </form>
  );
}
