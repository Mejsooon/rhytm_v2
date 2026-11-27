"use client";

import * as React from "react";

import {
  TimePicker,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dropdown,
  StatusBadge,
  Stepper,
  TextField,
} from "@/components/controls";
import { goalsSchema, parseDecimal } from "@/features/profile/schemas";
import { cn } from "@/lib/utils";
import { saveGoals } from "./actions";
import { CardFooter } from "./card-footer";
import { useCardForm } from "./use-card-form";

export type GoalsValues = {
  sleep: number;
  bed?: string;
  // Dwa cele treningowe: przełączniki i obie liczby (tekst z pól)
  trOn: boolean;
  kmOn: boolean;
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
  const [serverErrors, setServerErrors] = React.useState<
    Record<string, string>
  >({});

  const opisCeluId = React.useId();

  // Sprawdzamy tylko włączone cele; wyłączony zachowuje zapisaną liczbę (patrz przelacz)
  const wynikTr = goalsSchema.shape.weekly_workouts_goal.safeParse(value.tr);
  const wynikKm = goalsSchema.shape.weekly_km_goal.safeParse(value.km);
  let bladKlienta: string | undefined;
  if (!value.trOn && !value.kmOn) bladKlienta = "Włącz co najmniej jeden cel.";
  else if (value.trOn && !wynikTr.success)
    bladKlienta = `Treningi: ${wynikTr.error.issues[0]?.message}`;
  else if (value.kmOn && !wynikKm.success)
    bladKlienta = `Kilometry: ${wynikKm.error.issues[0]?.message}`;
  const bladCelu =
    bladKlienta ??
    serverErrors.training_goals ??
    serverErrors.weekly_workouts_goal ??
    serverErrors.weekly_km_goal;

  const sen = `${Math.floor(value.sleep / 60)}:${String(value.sleep % 60).padStart(2, "0")}`;

  function zmien(patch: Partial<GoalsValues>) {
    setServerErrors({});
    form.set(patch);
  }

  // Wyłączenie celu ze złą liczbą przywraca liczbę z zapisanej bazy formularza (nie zapisujemy śmieci)
  function przelacz(cel: "tr" | "km") {
    if (cel === "tr") {
      zmien({
        trOn: !value.trOn,
        tr: wynikTr.success ? value.tr : form.saved.tr,
      });
    } else {
      zmien({
        kmOn: !value.kmOn,
        km: wynikKm.success ? value.km : form.saved.km,
      });
    }
  }

  async function zapisz() {
    setSaving(true);
    try {
      const odpowiedz = await saveGoals({
        sleep_goal_min: value.sleep,
        workouts_goal_on: value.trOn,
        km_goal_on: value.kmOn,
        weekly_workouts_goal: parseDecimal(value.tr),
        weekly_km_goal: parseDecimal(value.km),
        currency: value.cur,
        week_start: value.week,
        sleep_bedtime: value.bed,
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
    <Card data-testid="karta-cele">
      <CardHeader>
        <div>
          <CardTitle as="h2">Cele</CardTitle>
          <CardDescription>
            Pokazywane na ekranie Dziś, w Sporcie i przy śnie.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 max-[799px]:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Cel snu</span>
            <Stepper
              wide
              ariaLabel="Cel snu"
              value={sen}
              decDisabled={value.sleep <= MIN_SNU}
              incDisabled={value.sleep >= MAX_SNU}
              onDec={() =>
                zmien({ sleep: Math.max(MIN_SNU, value.sleep - 15) })
              }
              onInc={() =>
                zmien({ sleep: Math.min(MAX_SNU, value.sleep + 15) })
              }
            />
            {value.bed !== undefined && (
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">Pora snu</span>
                <TimePicker clock="24" ariaLabel="Pora snu" value={value.bed} onChange={(bed) => zmien({ bed })} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Cele treningowe</span>
            {(
              [
                {
                  key: "tr",
                  label: "Treningi w tygodniu",
                  on: value.trOn,
                  val: value.tr,
                },
                {
                  key: "km",
                  label: "Kilometry biegu w tygodniu",
                  on: value.kmOn,
                  val: value.km,
                },
              ] as const
            ).map((cel) => (
              <div key={cel.key} className="flex min-h-8 items-center gap-2">
                <Checkbox
                  checked={cel.on}
                  ariaLabel={cel.label}
                  onChange={() => przelacz(cel.key)}
                />
                <span className="min-w-0 flex-1 text-[13px]">{cel.label}</span>
                {cel.on ? (
                  <div className="w-[72px] flex-none [&_label]:sr-only">
                    <TextField
                      label={cel.label}
                      type="text"
                      inputMode="numeric"
                      className={cn(
                        "text-right tabular-nums",
                        bladCelu && "border-destructive",
                      )}
                      value={cel.val}
                      aria-invalid={bladCelu ? true : undefined}
                      aria-describedby={
                        bladCelu ? `${opisCeluId}-blad` : undefined
                      }
                      onChange={(e) =>
                        zmien(
                          cel.key === "tr"
                            ? { tr: e.target.value }
                            : { km: e.target.value },
                        )
                      }
                    />
                  </div>
                ) : (
                  <StatusBadge tone="gray" className="w-[72px] flex-none">
                    wył.
                  </StatusBadge>
                )}
              </div>
            ))}
            {bladCelu && (
              <p
                id={`${opisCeluId}-blad`}
                className="m-0 text-xs text-destructive-foreground"
              >
                {bladCelu}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Waluta stron</span>
            <Dropdown
              variant="select"
              ariaLabel="Waluta stron"
              value={value.cur}
              onChange={(cur) => zmien({ cur })}
              options={[...WALUTY]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">
              Tydzień zaczyna się w
            </span>
            <Dropdown
              variant="select"
              ariaLabel="Początek tygodnia"
              value={value.week}
              onChange={(week) => zmien({ week })}
              options={[...TYDZIEN]}
            />
          </div>
        </div>
      </CardContent>
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
    </Card>
  );
}
