import { Check } from "lucide-react";

import { StatusBadge } from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  PAGE_TEMPLATES,
  effectivePages,
  type OnboardingDraft,
  type PageKey,
} from "../model";
import { StepHeader } from "./step-header";

// Krok 5: szablony stron (OnboardingPages + CMOnboarding).
// Web: karty z kwadratem 16 px i plakietkami pól; telefon: te same karty wyboru (.choice) z polami jako podpis 11 px.
export function StepPages({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  const wybrane = effectivePages(draft);

  function przelacz(key: PageKey) {
    const nowe = wybrane.includes(key)
      ? wybrane.filter((k) => k !== key)
      : [...wybrane, key];
    // Kolejność jak w sidebarze (PAGE_TEMPLATES)
    onChange({
      ...draft,
      pages: PAGE_TEMPLATES.map((t) => t.key).filter((k) => nowe.includes(k)),
    });
  }

  return (
    <>
      <StepHeader
        title="Od czego zaczynasz?"
        subtitle="Dodamy te strony do sidebaru. Każdą zmienisz albo usuniesz później."
        phoneSubtitle="Dodamy te strony do listy Stron. Każdą zmienisz albo usuniesz później."
      />

      <div
        data-testid="pages-web"
        role="group"
        aria-label="Strony"
        className="flex flex-col gap-2 max-[799px]:hidden"
      >
        {PAGE_TEMPLATES.map((strona) => {
          const wlaczona = wybrane.includes(strona.key);
          return (
            <button
              key={strona.key}
              type="button"
              aria-pressed={wlaczona}
              onClick={() => przelacz(strona.key)}
              className={cn(
                // Karta wyboru jak .opt z makiety (ten sam wzór co cele w kroku 3)
                "box-border flex w-full cursor-pointer items-start gap-3 rounded-lg border border-border bg-white bg-clip-padding px-3.5 py-3 text-left text-foreground shadow-xs transition-[border-color,background-color,box-shadow] duration-150 outline-none hover:bg-panel focus-visible:shadow-focus",
                wlaczona &&
                  "min-[800px]:border-black/[.24] min-[800px]:bg-black/[.025] min-[800px]:shadow-[0_0_0_1px_rgba(0,0,0,.12)] min-[800px]:hover:bg-black/[.025]",
              )}
            >
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
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{strona.name}</span>
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {strona.desc}
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {strona.fields.split(" · ").map((pole) => (
                    <StatusBadge key={pole} tone="gray">
                      {pole}
                    </StatusBadge>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        data-testid="pages-phone"
        role="group"
        aria-label="Strony"
        className="flex flex-col gap-2 min-[800px]:hidden"
      >
        {PAGE_TEMPLATES.map((strona) => {
          const wlaczona = wybrane.includes(strona.key);
          return (
            <button
              key={strona.key}
              type="button"
              role="checkbox"
              aria-checked={wlaczona}
              onClick={() => przelacz(strona.key)}
              className={cn(
                // .choice z CMOnboarding: ten sam wzór co karty webu
                "box-border flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-xl border border-input bg-white bg-clip-padding px-3.5 py-3 text-left text-foreground shadow-xs outline-none hover:bg-panel focus-visible:shadow-focus",
                wlaczona &&
                  "border-black/[.24] bg-black/[.025] shadow-[0_0_0_1px_rgba(0,0,0,.12)] hover:bg-black/[.025]",
              )}
            >
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
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{strona.name}</span>
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {strona.desc}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {strona.fields}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="m-0 text-[13px] text-muted-foreground max-[799px]:hidden">
        Pustą stronę i kolejne szablony dodasz później przyciskiem „Nowa strona”
        w sidebarze
      </p>
      <p className="m-0 text-xs leading-normal text-muted-foreground min-[800px]:hidden">
        Pustą stronę i kolejne szablony dodasz później przyciskiem „Nowa
        strona”.
      </p>
    </>
  );
}
