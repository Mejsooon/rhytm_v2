import { CalendarDays, Check } from "lucide-react";

import { Checkbox, TextField } from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  ROLES,
  categoriesForRoles,
  type OnboardingDraft,
  type RoleKey,
} from "../model";
import { StepHeader } from "./step-header";

// Krok 2: role (OnboardingRole + MOnboarding). Web: karty w siatce 2 kol., telefon: lista z Checkbox.
export function StepRoles({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  const kategorie = categoriesForRoles(draft.roles);

  function przelacz(rola: RoleKey) {
    const roles = draft.roles.includes(rola)
      ? draft.roles.filter((r) => r !== rola)
      : [...draft.roles, rola];
    onChange({ ...draft, roles });
  }

  return (
    <>
      <StepHeader
        title="Kim jesteś?"
        subtitle="Dopasujemy kategorie w kalendarzu. Możesz zaznaczyć kilka"
      />

      {/* Web */}
      <div
        data-testid="roles-web"
        className="grid grid-cols-2 gap-2 max-[799px]:hidden"
      >
        {ROLES.map((rola, i) => {
          const wlaczona = draft.roles.includes(rola.key);
          return (
            <button
              key={rola.key}
              type="button"
              aria-pressed={wlaczona}
              onClick={() => przelacz(rola.key)}
              className={cn(
                "box-border flex w-full cursor-pointer items-start gap-3 rounded-md border border-input bg-white px-3.5 py-3 text-left text-foreground transition-colors outline-none hover:border-ring focus-visible:shadow-focus",
                wlaczona &&
                  "border-primary shadow-[inset_0_0_0_1px_#171717] hover:border-primary",
                i === ROLES.length - 1 &&
                  ROLES.length % 2 === 1 &&
                  "col-span-2",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-px inline-flex size-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px]",
                  wlaczona
                    ? "border-primary bg-primary text-white"
                    : "border-border-strong bg-white text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={2} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{rola.title}</span>
                <span className="text-[13px] text-muted-foreground">{rola.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Telefon */}
      <div
        data-testid="roles-phone"
        className="overflow-hidden rounded-[14px] border border-input bg-white min-[800px]:hidden"
      >
        {ROLES.map((rola) => (
          <div
            key={rola.key}
            className="flex min-h-16 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0"
          >
            <Checkbox
              checked={draft.roles.includes(rola.key)}
              onChange={() => przelacz(rola.key)}
              label={
                <span className="flex flex-col">
                  <span className="font-medium">{rola.title}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {rola.desc}
                  </span>
                </span>
              }
            />
          </div>
        ))}
      </div>

      {draft.roles.includes("student") && (
        <TextField
          label={
            <>
              Kierunek studiów{" "}
              <span className="font-normal text-muted-foreground">opcjonalnie</span>
            </>
          }
          value={draft.studyField}
          placeholder="Np. Informatyka"
          webPlaceholder=" "
          onChange={(e) => onChange({ ...draft, studyField: e.target.value })}
        />
      )}

      {/* Web: jedna linia */}
      <div className="flex items-center gap-2 rounded-lg bg-panel px-3 py-2.5 text-[13px] text-soft-foreground max-[799px]:hidden">
        <CalendarDays
          aria-hidden="true"
          className="size-4 flex-none text-muted-foreground"
          strokeWidth={1.5}
        />
        <span>W kalendarzu: {kategorie.map((k) => k.name).join(", ")}</span>
      </div>

      {/* Telefon: chipy kategorii */}
      <div className="flex flex-wrap items-center gap-1.5 min-[800px]:hidden">
        <span className="mr-0.5 font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          W kalendarzu
        </span>
        {kategorie.map((k) => (
          <span
            key={k.name}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-input bg-white px-2.5 text-[13px]"
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: k.color }}
            />
            {k.name}
          </span>
        ))}
      </div>
    </>
  );
}
