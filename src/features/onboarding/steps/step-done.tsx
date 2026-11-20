"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { timezoneOptions } from "@/lib/time/timezones";
import { buildSummary, type OnboardingDraft } from "../model";

const LOGO = (
  <svg
    width="40"
    height="40"
    viewBox="0 0 48 48"
    role="img"
    aria-label="rhytm"
    className="flex-none"
  >
    <rect x="4" y="4" width="11" height="11" rx="3" fill="#171717" />
    <rect
      x="18"
      y="4"
      width="11"
      height="11"
      rx="3"
      fill="#171717"
      opacity="0.55"
    />
    <rect
      x="32"
      y="4"
      width="11"
      height="11"
      rx="3"
      fill="#171717"
      opacity="0.25"
    />
    <rect
      x="4"
      y="18"
      width="11"
      height="11"
      rx="3"
      fill="#171717"
      opacity="0.55"
    />
    <rect
      x="18"
      y="18"
      width="11"
      height="11"
      rx="3"
      fill="#171717"
      opacity="0.25"
    />
    <rect x="32" y="18" width="11" height="11" rx="3" fill="#15803d" />
    <rect
      x="4"
      y="32"
      width="11"
      height="11"
      rx="3"
      fill="#171717"
      opacity="0.25"
    />
    <rect x="18" y="32" width="11" height="11" rx="3" fill="#171717" />
    <rect
      x="32"
      y="32"
      width="11"
      height="11"
      rx="3"
      fill="#171717"
      opacity="0.55"
    />
  </svg>
);

// Krok 7: podsumowanie (OnboardingDone + MOnboarding). Przycisk „Przejdź do Dziś” jest w stopce kreatora.
export function StepDone({
  draft,
  now,
}: {
  draft: OnboardingDraft;
  now: Date;
}) {
  const router = useRouter();
  const imie = draft.name.trim() || "Ty";

  const miasto =
    timezoneOptions(now, draft.timezone).find((o) => o.value === draft.timezone)
      ?.city ?? draft.timezone.split("/").pop()!.replace(/_/g, " ");
  const webWiersze = buildSummary(draft, "web", miasto);
  const telefonWiersze = buildSummary(draft, "mobile", miasto);

  return (
    <>
      <div className="flex flex-col gap-4 max-[799px]:items-center max-[799px]:gap-3 max-[799px]:pt-2 max-[799px]:text-center">
        <span className="max-[799px]:hidden">{LOGO}</span>
        <span className="flex size-16 items-center justify-center rounded-[18px] border border-success-border bg-success-soft text-success min-[800px]:hidden">
          <Check aria-hidden="true" className="size-[30px]" strokeWidth={2} />
        </span>
        <div>
          <h1 className="m-0 text-[28px] leading-9 font-medium tracking-[-0.01em] max-[799px]:text-[26px] max-[799px]:leading-8">
            Gotowe, {imie}
          </h1>
          <p className="m-0 mt-2 text-soft-foreground max-[799px]:mt-1.5 max-[799px]:text-[13px] max-[799px]:text-muted-foreground">
            <span className="max-[799px]:hidden">
              Twój rhytm jest ułożony. Oto co przygotowaliśmy
            </span>
            <span className="min-[800px]:hidden">
              Twój rhytm jest ułożony. Oto co przygotowaliśmy.
            </span>
          </p>
        </div>
      </div>

      <dl
        data-testid="done-web"
        className="m-0 border-t border-border max-[799px]:hidden"
      >
        {webWiersze.map((w) => (
          <div
            key={w.key}
            className="grid min-h-12 grid-cols-[24px_128px_1fr_auto] items-center gap-2 border-b border-border"
          >
            <Check
              aria-hidden="true"
              className="size-4 text-success"
              strokeWidth={1.5}
            />
            <dt className="text-[13px] text-muted-foreground">{w.key}</dt>
            <dd className="m-0 font-medium">{w.value}</dd>
            <button
              type="button"
              aria-label={`Zmień: ${w.key}`}
              onClick={() => router.push(`/onboarding/${w.step}`)}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-soft-foreground hover:text-success"
            >
              Zmień
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-5 text-[13px] text-soft-foreground">
          Pierwszy blok dodasz skrótem
          <kbd className="rounded border border-b-2 border-input bg-white px-1.5 font-mono text-xs text-soft-foreground">
            Ctrl
          </kbd>
          <kbd className="rounded border border-b-2 border-input bg-white px-1.5 font-mono text-xs text-soft-foreground">
            K
          </kbd>
        </div>
      </dl>

      <div
        data-testid="done-phone"
        className="flex flex-col gap-4 min-[800px]:hidden"
      >
        <div className="rounded-xl border border-border bg-white">
          {telefonWiersze.map((w) => (
            <div
              key={w.key}
              className="flex min-h-[60px] items-center gap-3 border-b border-border px-3.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-muted-foreground">
                  {w.key}
                </span>
                <span className="mt-0.5 block text-sm">{w.value}</span>
              </span>
              <button
                type="button"
                aria-label={`Zmień: ${w.key}`}
                onClick={() => router.push(`/onboarding/${w.step}`)}
                className="min-h-11 cursor-pointer border-0 bg-transparent pl-2 text-sm text-soft-foreground underline"
              >
                Zmień
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-panel px-3.5 py-3">
          <Plus
            aria-hidden="true"
            className="size-[18px] flex-none text-muted-foreground"
            strokeWidth={2}
          />
          <span className="text-[13px] text-muted-foreground">
            Pierwszy blok dodasz przyciskiem „+” na ekranie Dziś.
          </span>
        </div>
      </div>
    </>
  );
}
