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
      className="w-full leading-[1.21]"
    >
      Wyślij link
    </Button>
  );
}

// Kroki 1–2 resetu hasła (CForgot.dc.html / CMForgot.dc.html). Krok 3 to osobna strona /nowe-haslo.
// Jeden komponent dla web i telefonu; różnice tylko klasami breakpointów.
export function ResetSteps() {
  const [state, formAction] = useActionState(requestPasswordReset, POCZATKOWY);
  const krok = state.status === "success" ? 2 : 1;

  return (
    <AuthShell
      headerNote={`krok ${krok} / 3`}
      progress={{ step: krok, total: 3 }}
      phoneBack="/logowanie"
      // Stopka tylko na webie i tylko w kroku 1 (w kroku 2 „Wróć do logowania” jest przyciskiem w treści);
      // na telefonie strzałka „Wstecz” w nagłówku, więc bez pustego kontenera stopki
      footerWebOnly
      footer={
        krok === 1 ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
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
          description="Jeśli konto z tym adresem istnieje, wysłaliśmy link. Ten sam komunikat widzi każdy, więc nikt nie sprawdzi, czy masz konto."
          before={
            <Button
              asChild
              variant="primary"
              size="lg"
              className="w-full leading-[1.21] max-[799px]:mt-2"
            >
              <Link href="/logowanie">Wróć do logowania</Link>
            </Button>
          }
          onResend={(token) => resendLink("recovery", state.email ?? "", token)}
        />
      ) : (
        <form
          action={formAction}
          className="flex flex-col gap-4 max-[799px]:m-auth-card max-[799px]:px-6 max-[799px]:py-6"
        >
          <div className="max-[799px]:mb-1">
            <h1 className="m-0 text-xl font-semibold tracking-[-0.015em]">
              <span className="max-[799px]:hidden">Nie pamiętasz hasła?</span>
              <span className="min-[800px]:hidden">Reset hasła</span>
            </h1>
            <p className="mt-1 mb-0 text-muted-foreground max-[799px]:leading-normal">
              Podaj e-mail konta, a wyślemy link do ustawienia nowego hasła.
              <span className="min-[800px]:hidden">
                {" "}
                Link działa 1 godzinę.
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
          <div className="flex flex-col [&_[role=status]]:mb-4">
            <TurnstileWidget resetKey={state} phoneStatus />
            <WyslijLink />
          </div>
        </form>
      )}
    </AuthShell>
  );
}
