import { CalendarDays, Check } from "lucide-react";

import { Card, StatusBadge, TextField } from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  ROLES,
  categoriesForRoles,
  type OnboardingDraft,
  type RoleKey,
} from "../model";
import { StepHeader } from "./step-header";

// Krok 2: role (OnboardingRole + CMOnboarding). Web: karty w siatce 2 kol., telefon: karta z wierszami `m-row` (role=checkbox).
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
                "box-border flex w-full cursor-pointer items-start gap-3 rounded-lg border border-border bg-white bg-clip-padding px-3.5 py-3 text-left text-foreground shadow-xs transition-[border-color,background-color,box-shadow] duration-150 outline-none hover:bg-panel focus-visible:shadow-focus",
                wlaczona &&
                  "border-black/[.24] bg-black/[.025] shadow-[0_0_0_1px_rgba(0,0,0,.12)] hover:bg-black/[.025]",
                i === ROLES.length - 1 &&
                  ROLES.length % 2 === 1 &&
                  "col-span-2",
              )}
            >
              {/* Kwadracik jak .cbx (16 px); to ozdoba w przycisku, stan niesie aria-pressed */}
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 inline-flex size-4 flex-none items-center justify-center rounded-[4px] border shadow-xs",
                  wlaczona
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-white text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{rola.title}</span>
                <span className="text-[13px] text-muted-foreground">
                  {rola.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Telefon: karta z wierszami; cały wiersz jest przyciskiem role=checkbox, kwadrat 16 px to ozdoba (.cbx) */}
      <Card
        data-testid="roles-phone"
        className="gap-0 overflow-hidden min-[800px]:hidden"
      >
        {ROLES.map((rola) => {
          const wlaczona = draft.roles.includes(rola.key);
          return (
            <button
              key={rola.key}
              type="button"
              role="checkbox"
              aria-checked={wlaczona}
              onClick={() => przelacz(rola.key)}
              className={cn(
                "m-row min-h-16 w-full cursor-pointer bg-white text-left font-[inherit] outline-none focus-visible:shadow-focus-inset",
                wlaczona && "bg-black/[.025]",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-4 flex-none items-center justify-center rounded-[4px] border shadow-xs",
                  wlaczona
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-white text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="flex-1">
                <span className="block font-medium">{rola.title}</span>
                <span className="text-[13px] text-muted-foreground">
                  {rola.desc}
                </span>
              </span>
            </button>
          );
        })}
      </Card>

      {draft.roles.includes("student") && (
        <TextField
          label={
            <>
              Kierunek studiów{" "}
              <span className="text-xs font-normal text-muted-foreground">
                opcjonalnie
              </span>
            </>
          }
          value={draft.studyField}
          placeholder="Np. Informatyka"
          webPlaceholder=" "
          onChange={(e) => onChange({ ...draft, studyField: e.target.value })}
        />
      )}

      {/* Web (.alert z makiety): „W kalendarzu:” i plakietki kategorii */}
      <div
        data-testid="roles-calendar-web"
        className="flex items-center gap-2.5 rounded-lg border border-border bg-black/[.02] px-3.5 py-3 text-sm max-[799px]:hidden"
      >
        <CalendarDays
          aria-hidden="true"
          className="size-4 flex-none text-muted-foreground"
          strokeWidth={2}
        />
        <span className="flex-1">W kalendarzu:</span>
        <span className="flex flex-wrap justify-end gap-1">
          {kategorie.map((k) => (
            <StatusBadge key={k.name} tone="outline">
              <span
                aria-hidden="true"
                className="size-2 flex-none rounded-full"
                style={{ background: k.color }}
              />
              {k.name}
            </StatusBadge>
          ))}
        </span>
      </div>

      {/* Telefon (CMOnboarding): „W kalendarzu” (.lbl) i chipy kategorii z kolorem z danych (tło 12, ramka 4d) */}
      <div
        data-testid="roles-calendar-phone"
        className="flex flex-wrap items-center gap-1.5 min-[800px]:hidden"
      >
        <span className="mr-0.5 text-xs font-medium text-muted-foreground">
          W kalendarzu
        </span>
        {kategorie.map((k) => (
          <span
            key={k.name}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px]"
            style={{
              background: `${k.color}12`,
              borderColor: `${k.color}4d`,
            }}
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
