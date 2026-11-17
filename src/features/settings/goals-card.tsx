"use client";

import * as React from "react";

import { Dropdown, Stepper, TextField } from "@/components/controls";
import { goalsSchema, parseDecimal } from "@/features/profile/schemas";
import { saveGoals } from "./actions";
import { CardFooter } from "./card-footer";
import { useCardForm } from "./use-card-form";

export type GoalsValues = {
  sleep: number;
  km: string;
  cur: "PLN" | "EUR" | "USD" | "GBP";
  week: "mon" | "sun";
};

const WALUTY = [
  { value: "PLN", label: "PLN", hint: "zł" },
  { value: "EUR", label: "EUR", hint: "€" },
  { value: "USD", label: "USD", hint: "$" },
  { value: "GBP", label: "GBP", hint: "£" },
] as const;

const TYDZIEN = [
  { value: "mon", label: "Poniedziałek" },
  { value: "sun", label: "Niedzielę" },
] as const;

// Cel snu 5:00–11:00 co 15 min
const MIN_SNU = 300;
const MAX_SNU = 660;

// Karta „Cele” (Settings.dc.html)
export function GoalsCard({ saved }: { saved: GoalsValues }) {
  const form = useCardForm(saved);
  const { value } = form;
  const [saving, setSaving] = React.useState(false);
  const [serverErrors, setServerErrors] = React.useState<Record<string, string>>({});

  const wynik = goalsSchema.shape.weekly_km_goal.safeParse(value.km);
  const kmError = wynik.success ? undefined : wynik.error.issues[0]?.message;
  const errors = { ...serverErrors, ...(kmError ? { weekly_km_goal: kmError } : {}) };

  const sen = `${Math.floor(value.sleep / 60)}:${String(value.sleep % 60).padStart(2, "0")}`;

  function zmien(patch: Partial<GoalsValues>) {
    setServerErrors({});
    form.set(patch);
  }

  async function zapisz() {
    setSaving(true);
    try {
      const odpowiedz = await saveGoals({
        sleep_goal_min: value.sleep,
        weekly_km_goal: parseDecimal(value.km),
        currency: value.cur,
        week_start: value.week,
      });
      if (odpowiedz.ok) {
        setServerErrors({});
        form.markSaved(value);
      } else {
        setServerErrors(odpowiedz.errors);
      }
    } catch {
      setServerErrors({ form: "Nie udało się zapisać. Spróbuj ponownie." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#eaeaea] bg-white">
      <div className="p-5">
        <h2 className="m-0 text-base font-semibold">Cele</h2>
        <p className="mt-1 mb-4 text-[#666666]">Pokazywane na ekranie Dziś, w Sporcie i przy śnie.</p>
        <div className="grid grid-cols-2 gap-3.5 max-[799px]:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Cel snu</span>
            <Stepper
              ariaLabel="Cel snu"
              value={sen}
              decDisabled={value.sleep <= MIN_SNU}
              incDisabled={value.sleep >= MAX_SNU}
              onDec={() => zmien({ sleep: Math.max(MIN_SNU, value.sleep - 15) })}
              onInc={() => zmien({ sleep: Math.min(MAX_SNU, value.sleep + 15) })}
            />
          </div>
          <TextField
            label="Tygodniowy cel km"
            type="text"
            inputMode="numeric"
            className="font-mono"
            value={value.km}
            error={errors.weekly_km_goal}
            onChange={(e) => zmien({ km: e.target.value })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Waluta stron</span>
            <Dropdown
              ariaLabel="Waluta stron"
              value={value.cur}
              onChange={(cur) => zmien({ cur })}
              options={[...WALUTY]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Tydzień zaczyna się w</span>
            <Dropdown
              ariaLabel="Początek tygodnia"
              value={value.week}
              onChange={(week) => zmien({ week })}
              options={[...TYDZIEN]}
            />
          </div>
        </div>
      </div>
      <CardFooter
        message={form.message}
        texts={{
          idle: "Waluta dotyczy pól „Kwota cykliczna”.",
          dirty: "Masz niezapisane zmiany.",
          saved: "Zapisano ✓ — cele zaktualizowane na ekranie Dziś",
        }}
        formError={serverErrors.form}
        dirty={form.dirty}
        canSave={form.dirty && !kmError}
        saving={saving}
        onReset={() => {
          setServerErrors({});
          form.reset();
        }}
        onSave={zapisz}
      />
    </section>
  );
}
