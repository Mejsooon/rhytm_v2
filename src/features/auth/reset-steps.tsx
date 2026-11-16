"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/controls/button";
import { TextField } from "@/components/controls/field";

import { requestPasswordReset, resendLink, type AuthFormState } from "./actions";
import { CheckInbox } from "./check-inbox";

const POCZATKOWY: AuthFormState = { status: "idle" };

function WyslijLink() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} className="w-full leading-[1.21] max-[799px]:text-[15px]">
      Wyślij link
    </Button>
  );
}

// Kroki 1–2 resetu hasła (Forgot.dc.html / MForgot.dc.html). Krok 3 to osobna strona /nowe-haslo.
// Jeden komponent dla web i telefonu; różnice tylko klasami breakpointów.
export function ResetSteps() {
  const [state, formAction] = useActionState(requestPasswordReset, POCZATKOWY);
  const krok = state.status === "success" ? 2 : 1;

  return (
    <AuthShell width={322} headerNote={`krok ${krok} / 3`} phoneBack="/logowanie">
      {krok === 2 ? (
        <CheckInbox
          kind="reset"
          email={state.email}
          description={
            <>
              <span className="max-[799px]:hidden">
                Jeśli konto z tym adresem istnieje, wysłaliśmy link. Ten sam komunikat widzi każdy, więc nikt nie sprawdzi,
                czy masz konto.
              </span>
              <span className="min-[800px]:hidden">Jeśli konto istnieje, link do zmiany hasła jest już w drodze.</span>
            </>
          }
          before={
            <Button asChild variant="primary" className="w-full leading-[1.21] max-[799px]:mt-3 max-[799px]:text-[15px]">
              <Link href="/logowanie">Wróć do logowania</Link>
            </Button>
          }
          onResend={async () => {
            await resendLink("recovery", state.email ?? "");
          }}
        />
      ) : (
        <form action={formAction} className="flex flex-col gap-4 max-[799px]:gap-[22px]">
          <div>
            <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em] max-[799px]:text-[28px]">
              <span className="max-[799px]:hidden">Nie pamiętasz hasła?</span>
              <span className="min-[800px]:hidden">Reset hasła</span>
            </h1>
            <p className="mt-1.5 mb-0 text-[#666666] max-[799px]:mt-2 max-[799px]:text-[13px] max-[799px]:leading-normal">
              <span className="max-[799px]:hidden">Podaj e-mail konta, a wyślemy link do ustawienia nowego hasła.</span>
              <span className="min-[800px]:hidden">Podaj e-mail konta. Wyślemy link, który działa przez 30 minut.</span>
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
            <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
              {state.message}
            </p>
          )}
          {/* Widżet (interaction-only) jest zwykle pusty — razem z przyciskiem, żeby nie dodawał odstępu */}
          <div className="flex flex-col">
            <TurnstileWidget resetKey={state} />
            <WyslijLink />
          </div>
          <Link href="/logowanie" className="text-center text-[13px] text-[#666666] underline max-[799px]:hidden">
            ← Wróć do logowania
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
