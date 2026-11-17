"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { RhytmLogo } from "@/components/brand/rhytm-logo";
import { Button } from "@/components/controls";
import { signOut } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import { completeOnboarding, saveOnboardingStep } from "./actions";
import { LivePreview } from "./live-preview";
import { canContinue, stepPayload, type OnboardingDraft } from "./model";
import { STEP_VIEWS } from "./step-views";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const KROKI = [1, 2, 3, 4, 5, 6, 7] as const;

function Wyloguj({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn("cursor-pointer border-0 bg-transparent text-[#525252] hover:text-[#171717]", className)}
      >
        Wyloguj
      </button>
    </form>
  );
}

// Kreator onboardingu: nagłówek, pasek postępu, karta z treścią kroku, stopka i podgląd na żywo.
// Web i telefon są w DOM razem, przełączane klasami (max-[799px]: / min-[800px]:).
// `now` przychodzi z serwera (strona), żeby data w podglądzie była taka sama przy renderze i hydratacji.
export function OnboardingWizard({
  step,
  initialDraft,
  avatarUrl,
  now,
  userId,
  firstVisit = false,
}: {
  step: Step;
  initialDraft: OnboardingDraft;
  avatarUrl: string | null;
  now: Date;
  userId: string;
  // true, gdy krok 1 nie był jeszcze zapisany (strefa z przeglądarki trafia wtedy do szkicu)
  firstVisit?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(initialDraft);
  // Podgląd świeżo wgranego zdjęcia: lokalny object URL, zwalniany przy zmianie i odmontowaniu
  const [podglad, setPodglad] = React.useState<string | null>(null);
  const podgladRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    return () => {
      if (podgladRef.current) URL.revokeObjectURL(podgladRef.current);
    };
  }, []);
  function ustawPodglad(plik: File) {
    if (podgladRef.current) URL.revokeObjectURL(podgladRef.current);
    const url = URL.createObjectURL(plik);
    podgladRef.current = url;
    setPodglad(url);
  }
  const widocznyAvatar = podglad ?? avatarUrl;
  // Stan „w trakcie zapisu” i błąd są przypisane do kroku, więc po przejściu dalej same wygasają
  const [pendingStep, setPendingStep] = React.useState<Step | null>(null);
  const [error, setError] = React.useState<{ step: Step; message: string } | null>(null);
  // Strażnik dla dwóch synchronicznych kliknięć (stan nie zdąży się zaktualizować)
  const wToku = React.useRef(false);

  const pending = pendingStep === step;
  const ostatni = step === 7;
  const blad = error?.step === step ? error.message : null;

  async function wykonaj(
    zapis: () => Promise<{ ok: true } | { ok: false; message: string }>,
    dalej: string | null,
  ) {
    if (wToku.current) return;
    wToku.current = true;
    setPendingStep(step);
    setError(null);
    try {
      const wynik = await zapis();
      if (wynik.ok) {
        // Przycisk zostaje nieaktywny do czasu zmiany kroku
        if (dalej) router.push(dalej);
        return;
      }
      setError({ step, message: wynik.message });
    } catch {
      setError({ step, message: "Nie udało się zapisać. Spróbuj ponownie." });
    }
    wToku.current = false;
    setPendingStep(null);
  }

  // Nowe propsy z serwera (inny krok albo świeży szkic po powrocie na zachowaną trasę):
  // bierzemy szkic z serwera i zdejmujemy blokadę zapisu oraz błąd
  const [poprzedniePropsy, setPoprzedniePropsy] = React.useState({ step, initialDraft });
  if (poprzedniePropsy.step !== step || poprzedniePropsy.initialDraft !== initialDraft) {
    setPoprzedniePropsy({ step, initialDraft });
    setDraft(initialDraft);
    setPendingStep(null);
    setError(null);
  }
  React.useEffect(() => {
    wToku.current = false;
  }, [step]);

  // Next (cacheComponents) chowa trasę w <Activity> i przywraca jej stan. Przy ukryciu czyścimy stan
  // przejściowy, żeby po powrocie (Wstecz, „Zmień”) przyciski nie zostały zablokowane po udanym zapisie
  React.useLayoutEffect(() => {
    return () => {
      wToku.current = false;
      setPendingStep(null);
      setError(null);
    };
  }, []);

  function dalej() {
    if (ostatni) {
      void wykonaj(async () => {
        const wynik = await completeOnboarding();
        return wynik;
      }, null);
      return;
    }
    void wykonaj(
      () => saveOnboardingStep(step as 1 | 2 | 3 | 4 | 5 | 6, stepPayload(step as 1 | 2 | 3 | 4 | 5 | 6, draft)),
      `/onboarding/${step + 1}`,
    );
  }

  function pomin() {
    void wykonaj(
      () => saveOnboardingStep(4, { referral_source: null, referral_other: null }),
      "/onboarding/5",
    );
  }

  function wstecz() {
    if (step > 1) router.push(`/onboarding/${step - 1}`);
  }

  const Widok = STEP_VIEWS[step];
  const mozeDalej = canContinue(step, draft) && !pending;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-white text-sm leading-[1.45] text-[#171717] tabular-nums min-[800px]:bg-[#fafafa]">
      {/* Nagłówek web */}
      <header className="flex h-16 flex-none items-center gap-2 px-6 max-[799px]:hidden">
        <RhytmLogo size={24} withWordmark />
        <span className="ml-auto font-mono text-xs text-[#737373]">Krok {step} z 7</span>
        <Wyloguj className="ml-4 p-0 text-[13px]" />
      </header>

      {/* Nagłówek telefon */}
      <header className="box-border flex min-h-[60px] flex-none items-center gap-1 px-2 pt-2 min-[800px]:hidden">
        {step > 1 ? (
          <button
            type="button"
            aria-label="Wstecz"
            onClick={wstecz}
            disabled={pending}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent p-0 text-[#171717] hover:bg-[#f5f5f5]"
          >
            <ChevronLeft aria-hidden="true" className="size-[22px]" strokeWidth={2} />
          </button>
        ) : (
          <span className="flex items-center px-2">
            <RhytmLogo size={26} />
          </span>
        )}
        <span className="flex-1 text-center font-mono text-[11px] tracking-[0.06em] text-[#6b6b6b] uppercase">
          Krok {step} z 7
        </span>
        <Wyloguj className="inline-flex h-11 items-center px-3 text-sm text-[#666666]" />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center min-[800px]:px-6 min-[800px]:pb-10">
        <div className="flex h-full w-full max-w-[1120px] flex-col overflow-hidden min-[800px]:h-[720px] min-[800px]:rounded-2xl min-[800px]:border min-[800px]:border-[#eaeaea] min-[800px]:bg-white min-[800px]:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
          {/* Pasek postępu: 7 segmentów po 4 px */}
          <div
            role="progressbar"
            aria-label="Postęp onboardingu"
            aria-valuemin={1}
            aria-valuemax={7}
            aria-valuenow={step}
            className="grid grid-cols-7 gap-1 px-4 pt-1 pb-1 min-[800px]:px-5 min-[800px]:pt-4 min-[800px]:pb-0"
          >
            {KROKI.map((k) => (
              <span
                key={k}
                className={cn("h-1 rounded-sm", k <= step ? "bg-[#171717]" : "bg-[#e5e5e5]")}
              />
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-[520px_1fr] max-[1100px]:grid-cols-1">
            <div className="flex min-h-0 flex-col px-5 pt-4 pb-0 min-[800px]:px-10 min-[800px]:pt-8 min-[800px]:pb-6">
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-6 min-[800px]:pb-0">
                <Widok
                  draft={draft}
                  onChange={setDraft}
                  userId={userId}
                  avatarUrl={widocznyAvatar}
                  onAvatarFile={ustawPodglad}
                  firstVisit={firstVisit}
                  now={now}
                />
              </div>

              <div
                data-testid="wizard-footer"
                className="flex flex-none flex-col gap-2 border-t border-[#f0f0f0] bg-white pt-3 pb-[30px] max-[799px]:sticky max-[799px]:bottom-0 max-[799px]:-mx-5 max-[799px]:px-5 min-[800px]:flex-row min-[800px]:flex-wrap min-[800px]:items-center min-[800px]:pt-5 min-[800px]:pb-0"
              >
                {/* Web: „Wstecz” w stopce; na telefonie jest w nagłówku */}
                <Button
                  variant="secondary"
                  onClick={wstecz}
                  disabled={step === 1 || pending}
                  className="max-[799px]:hidden"
                >
                  Wstecz
                </Button>
                <span className="flex-1 max-[799px]:hidden" />
                {step === 4 && (
                  <Button
                    variant="ghost"
                    onClick={pomin}
                    disabled={pending}
                    className="text-[#525252] max-[799px]:order-2 max-[799px]:h-11 max-[799px]:border-0"
                  >
                    Pomiń
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={dalej}
                  disabled={!mozeDalej}
                  className="max-[799px]:order-1 max-[799px]:w-full"
                >
                  {ostatni ? "Przejdź do Dziś" : "Dalej"}
                </Button>
                {blad && (
                  <p
                    role="alert"
                    className="m-0 text-[13px] text-[#b91c1c] max-[799px]:order-3 min-[800px]:basis-full"
                  >
                    {blad}
                  </p>
                )}
              </div>
            </div>

            <div className="relative overflow-hidden border-l border-[#eaeaea] bg-[#f4f4f5] max-[1100px]:hidden">
              <LivePreview draft={draft} step={step} avatarUrl={widocznyAvatar} now={now} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
