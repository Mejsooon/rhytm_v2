import { Check } from "lucide-react";

import { StatusBadge } from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  PAGE_TEMPLATES,
  effectivePages,
  recommendedPages,
  type OnboardingDraft,
  type PageKey,
} from "../model";
import { StepHeader } from "./step-header";

// Krok 5: szablony stron (OnboardingPages + MOnboarding).
// Web: karty z kwadratem 18 px; telefon: karty z polem 24 px i zielonym zaznaczeniem.
export function StepPages({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  const wybrane = effectivePages(draft);
  const polecane = recommendedPages(draft.goals);

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
      <div className="max-[799px]:hidden">
        <StepHeader
          title="Od czego zaczynasz?"
          subtitle="Dodamy te strony do sidebaru. Zaznaczyliśmy je na podstawie Twoich celów"
        />
      </div>
      <div className="min-[800px]:hidden">
        <StepHeader
          title="Od czego zaczynasz?"
          subtitle="Dodamy te strony do listy Stron. Zaznaczyliśmy je na podstawie Twoich celów."
        />
      </div>

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
                "box-border flex w-full cursor-pointer items-start gap-3 rounded-md border border-input bg-white px-3.5 py-3 text-left text-foreground transition-colors outline-none hover:border-ring focus-visible:ring-2 focus-visible:ring-success",
                wlaczona &&
                  "border-primary shadow-[inset_0_0_0_1px_#171717] hover:border-primary",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-px inline-flex size-[18px] flex-none items-center justify-center rounded-[5px] border border-border-strong",
                  wlaczona && "border-primary bg-primary text-white",
                )}
              >
                {wlaczona && <Check className="size-3" strokeWidth={1.5} />}
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{strona.name}</span>
                  {polecane.includes(strona.key) && (
                    <span className="text-xs text-success">
                      z Twoich celów
                    </span>
                  )}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {strona.desc}
                </span>
                <span className="font-mono text-[11px] text-faint-foreground">
                  {strona.fields}
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
                "box-border flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-xl border border-input bg-white p-3.5 text-left text-foreground outline-none focus-visible:ring-2 focus-visible:ring-success",
                wlaczona && "border-success bg-success-soft",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-6 flex-none items-center justify-center rounded-[7px] border-[1.5px] border-border-strong bg-white text-white",
                  wlaczona && "border-success bg-success",
                )}
              >
                {wlaczona && <Check className="size-4" strokeWidth={3} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{strona.name}</span>
                  {polecane.includes(strona.key) && (
                    <StatusBadge tone="green">z Twoich celów</StatusBadge>
                  )}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {strona.desc}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
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
