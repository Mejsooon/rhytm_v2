"use client";

import * as React from "react";

import { Dropdown, Segment, Stepper, TextField } from "@/components/controls";
import { goalsSchema, parseDecimal } from "@/features/profile/schemas";
import { cn } from "@/lib/utils";
import { saveGoals } from "./actions";
import { CardFooter } from "./card-footer";
import { useCardForm } from "./use-card-form";

export type GoalsValues = {
  sleep: number;
  // Cel treningowy: rodzaj i obie liczby (tekst z pól)
  goalType: "workouts" | "km";
  tr: string;
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

const RODZAJE_CELU = [
  { value: "workouts", label: "Treningi" },
  { value: "km", label: "Km" },
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

  const opisCeluId = React.useId();

  // Sprawdzamy liczbę wybranego rodzaju; druga zawsze jest poprawna (patrz zmienRodzaj)
  const naKm = value.goalType === "km";
  const poleCelu = naKm ? "weekly_km_goal" : "weekly_workouts_goal";
  const wynik = naKm
    ? goalsSchema.shape.weekly_km_goal.safeParse(value.km)
    : goalsSchema.shape.weekly_workouts_goal.safeParse(value.tr);
  const bladKlienta = wynik.success ? undefined : wynik.error.issues[0]?.message;
  const bladCelu = bladKlienta ?? serverErrors[poleCelu];

  const sen = `${Math.floor(value.sleep / 60)}:${String(value.sleep % 60).padStart(2, "0")}`;

  function zmien(patch: Partial<GoalsValues>) {
    setServerErrors({});
    form.set(patch);
  }

  // Zmiana rodzaju: zła liczba nie może zostać ukryta, więc wraca do bieżącej zapisanej bazy formularza
  function zmienRodzaj(goalType: GoalsValues["goalType"]) {
    if (wynik.success) {
      zmien({ goalType });
    } else if (naKm) {
      zmien({ goalType, km: form.saved.km });
    } else {
      zmien({ goalType, tr: form.saved.tr });
    }
  }

  async function zapisz() {
    setSaving(true);
    try {
      const odpowiedz = await saveGoals({
        sleep_goal_min: value.sleep,
        weekly_goal_type: value.goalType,
        weekly_workouts_goal: parseDecimal(value.tr),
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
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Cel treningowy</span>
            <div className="flex items-center gap-1.5">
              <div className="flex-none">
                <Segment
                  ariaLabel="Rodzaj celu treningowego"
                  value={value.goalType}
                  options={[...RODZAJE_CELU]}
                  onChange={zmienRodzaj}
                />
              </div>
              {/* Etykieta pola tylko dla czytników ekranu; podpowiedź i błąd są pod całym wierszem jak w makiecie */}
              <div className="min-w-0 flex-1 [&_label]:sr-only">
                <TextField
                  label={naKm ? "Kilometry w tygodniu" : "Treningi w tygodniu"}
                  type="text"
                  inputMode="numeric"
                  className={cn("font-mono", bladCelu && "border-[#b91c1c]")}
                  value={naKm ? value.km : value.tr}
                  aria-invalid={bladCelu ? true : undefined}
                  aria-describedby={bladCelu ? `${opisCeluId} ${opisCeluId}-blad` : opisCeluId}
                  onChange={(e) => zmien(naKm ? { km: e.target.value } : { tr: e.target.value })}
                />
              </div>
            </div>
            <span id={opisCeluId} className="font-mono text-xs text-[#6b6b6b]">
              {naKm ? "km w tygodniu" : "treningów w tygodniu"}
            </span>
            {bladCelu && (
              <p id={`${opisCeluId}-blad`} className="m-0 text-xs text-[#b91c1c]">
                {bladCelu}
              </p>
            )}
          </div>
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
        canSave={form.dirty && !bladKlienta}
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
