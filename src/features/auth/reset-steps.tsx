"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/controls/button";
import { TextField } from "@/components/controls/field";

import {
  requestPasswordReset,
  resendLink,
  type AuthFormState,
} from "./actions";
import { CheckInbox } from "./check-inbox";

const POCZATKOWY: AuthFormState = { status: "idle" };

function WyslijLink() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      disabled={pending}
      className="w-full leading-[1.21] max-[799px]:text-[15px]"
    >
      Wyślij link
    </Button>
  );
}

// Kroki 1–2 resetu hasła (CForgot.dc.html / MForgot.dc.html). Krok 3 to osobna strona /nowe-haslo.
// Jeden komponent dla web i telefonu; różnice tylko klasami breakpointów.
export function ResetSteps() {
  const [state, formAction] = useActionState(requestPasswordReset, POCZATKOWY);
  const krok = state.status === "success" ? 2 : 1;

  return (
    <AuthShell
      headerNote={`krok ${krok} / 3`}
      progress={{ step: krok, total: 3 }}
      phoneBack="/logowanie"
      footer={
        krok === 1 ? (
          // Stopka tylko w kroku 1 (w kroku 2 „Wróć do logowania” jest przyciskiem w treści); na telefonie link ukryty jak dotąd
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground max-[799px]:hidden"
          >
            <Link href="/logowanie">
              <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2} />
              Wróć do logowania
            </Link>
          </Button>
        ) : undefined
      }
    >
      {krok === 2 ? (
        <CheckInbox
          kind="reset"
          email={state.email}
          description={
            <>
              <span className="max-[799px]:hidden">
                Jeśli konto z tym adresem istnieje, wysłaliśmy link. Ten sam
                komunikat widzi każdy, więc nikt nie sprawdzi, czy masz konto.
              </span>
              <span className="min-[800px]:hidden">
                Jeśli konto istnieje, link do zmiany hasła jest już w drodze.
              </span>
            </>
          }
          before={
            <Button
              asChild
              variant="primary"
              size="lg"
              className="w-full leading-[1.21] max-[799px]:mt-3 max-[799px]:text-[15px]"
            >
              <Link href="/logowanie">Wróć do logowania</Link>
            </Button>
          }
          onResend={(token) => resendLink("recovery", state.email ?? "", token)}
        />
      ) : (
        <form
          action={formAction}
          className="flex flex-col gap-4 max-[799px]:gap-[22px]"
        >
          <div>
            <h1 className="m-0 text-xl font-semibold tracking-[-0.015em] max-[799px]:text-[28px] max-[799px]:tracking-[-0.02em]">
              <span className="max-[799px]:hidden">Nie pamiętasz hasła?</span>
              <span className="min-[800px]:hidden">Reset hasła</span>
            </h1>
            <p className="mt-1 mb-0 text-muted-foreground max-[799px]:mt-2 max-[799px]:text-[13px] max-[799px]:leading-normal">
              <span className="max-[799px]:hidden">
                Podaj e-mail konta, a wyślemy link do ustawienia nowego hasła.
              </span>
              <span className="min-[800px]:hidden">
                Podaj e-mail konta. Wyślemy link, który działa przez 30 minut.
              </span>
            </p>
          </div>
          <TextField
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ty@example.com"
            required
            className="leading-[1.21]"
            error={state.fieldErrors?.email}
          />
          {state.status === "error" && state.message && (
            <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
              {state.message}
            </p>
          )}
          {/* Widżet (interaction-only) jest zwykle pusty — razem z przyciskiem, żeby nie dodawał odstępu */}
          <div className="flex flex-col">
            <TurnstileWidget resetKey={state} />
            <WyslijLink />
          </div>
        </form>
      )}
    </AuthShell>
  );
}
