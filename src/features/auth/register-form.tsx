"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { GoogleButton } from "@/components/auth/google-button";
import { OrSeparator } from "@/components/auth/or-separator";
import { PasswordInput } from "@/components/auth/password-input";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/controls/button";
import { Checkbox } from "@/components/controls/checkbox";
import { TextField } from "@/components/controls/field";
import { checkPasswordRules, passwordStrength } from "@/lib/auth/password-rules";

import { checkPasswordLeak, resendConfirmation, signInWithGoogle, signUp, type AuthFormState } from "./actions";
import { CheckInbox } from "./check-inbox";
import { PasswordRulesList, type LeakStatus } from "./password-rules-list";
import { PhoneStrengthBar, StrengthBar } from "./strength-bar";

const POCZATKOWY: AuthFormState = { status: "idle" };

// Przycisk wysyłki. `disabled` w trakcie wysyłania (useFormStatus), `aria-disabled` gdy formularz niekompletny —
// wtedy klik i Enter nie wysyłają, ale przycisk zostaje w kolejności tabulatora.
function UtworzKonto({ gotowe }: { gotowe: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending}
      aria-disabled={!gotowe}
      onClick={(e) => {
        if (!gotowe) e.preventDefault();
      }}
      className="w-full leading-[1.21] aria-disabled:opacity-50 max-[799px]:text-[15px]"
    >
      Utwórz konto
    </Button>
  );
}

// Jeden formularz dla web i telefonu (Register.dc.html / MRegister.dc.html). Różnice: tylko klasy breakpointów.
export function RegisterForm() {
  const [state, formAction] = useActionState(signUp, POCZATKOWY);
  // Pola trzymamy w stanie, bo React czyści pola formularza po wysłaniu akcji
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tos, setTos] = useState(false);
  const [leak, setLeak] = useState<LeakStatus>("unknown");

  // Reguła „nie ma go w bazie wycieków”: zapytanie do serwera po 400 ms ciszy w polu hasła
  useEffect(() => {
    if (!password) return;
    let nieaktualne = false;
    const t = setTimeout(async () => {
      // Błąd sieci lub serwera: stan zostaje „nieznany” (serwer i tak sprawdzi hasło przy wysyłce)
      try {
        const wyciek = await checkPasswordLeak(password);
        if (!nieaktualne) setLeak(wyciek ? "leaked" : "ok");
      } catch {}
    }, 400);
    return () => {
      nieaktualne = true;
      clearTimeout(t);
    };
  }, [password]);

  if (state.status === "success") {
    const adres = state.email ?? email;
    return (
      <CheckInbox
        email={adres}
        onResend={(token) => resendConfirmation(adres, token)}
      />
    );
  }

  const reguly = checkPasswordRules(password);
  const gotowe = tos && reguly.minLength && reguly.lettersAndDigits && leak !== "leaked";
  const silaHasla = passwordStrength(password, leak === "ok");

  return (
    // Kontener z kolejnością bloków; Google to osobny <form> (Enter w polach wysyła rejestrację hasłem).
    // Na telefonie (MRegister.dc.html) nie ma przycisku Google ani separatora.
    <div className="flex flex-1 flex-col gap-4 max-[799px]:gap-5">
      <div className="order-1">
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em] max-[799px]:text-[28px]">Załóż konto</h1>
        <p className="mt-1.5 mb-0 text-[#666666] max-[799px]:text-[13px]">
          <span className="max-[799px]:hidden">Wyślemy link, żeby potwierdzić Twój e-mail.</span>
          <span className="min-[800px]:hidden">Kalendarz, nawyki, sport i strony w jednym miejscu.</span>
        </p>
      </div>

      <form action={signInWithGoogle} className="order-2 max-[799px]:hidden">
        <GoogleButton webLabel="Kontynuuj z Google" />
      </form>
      <OrSeparator label="lub e-mailem" className="order-3 max-[799px]:hidden" />

      <form action={formAction} className="order-4 flex flex-col gap-4 max-[799px]:gap-5">
        <TextField
          label={
            <>
              <span className="max-[799px]:hidden">Nazwa</span>
              <span className="min-[800px]:hidden">Imię</span>
            </>
          }
          name="displayName"
          type="text"
          autoComplete="given-name"
          placeholder="Jak mamy się do ciebie zwracać?"
          webPlaceholder="Jak mamy się do Ciebie zwracać?"
          required
          className="leading-[1.21]"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={state.fieldErrors?.displayName}
        />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ty@example.com"
          required
          className="leading-[1.21]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={state.fieldErrors?.email}
        />

        <div className="flex flex-col">
          <PasswordInput
            name="password"
            label="Hasło"
            autoComplete="new-password"
            placeholder="Min. 10 znaków"
            webPlaceholder="Wpisz, żeby zobaczyć wymagania"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setLeak("unknown");
            }}
          />
          <StrengthBar score={silaHasla} className="mt-4 max-[799px]:mt-2.5" />
          <PhoneStrengthBar password={password} className="mt-2.5" />
          {/* Na telefonie nie ma listy reguł — powód blokady wysyłki musi być widoczny tutaj */}
          {leak === "leaked" && (
            <p className="m-0 mt-1.5 font-mono text-[11px] text-[#b91c1c] min-[800px]:hidden">
              To hasło wyciekło w innym serwisie. Wybierz inne.
            </p>
          )}
          <PasswordRulesList password={password} leak={leak} className="mt-2.5 max-[799px]:hidden" />
        </div>

        {/* Własny checkbox nie jest natywnym polem — jego stan przekazujemy ukrytym inputem */}
        {tos && <input type="hidden" name="tos" value="on" />}
        <div className="max-[799px]:text-sm max-[799px]:text-[#404040]">
          <Checkbox
            checked={tos}
            onChange={setTos}
            label={
              <>
                Akceptuję{" "}
                <Link href="/regulamin" className="underline">
                  regulamin
                </Link>{" "}
                i{" "}
                <Link href="/prywatnosc" className="underline">
                  politykę prywatności
                </Link>
                .
              </>
            }
          />
        </div>

        <TurnstileWidget resetKey={state} />

        <div className="flex flex-col gap-4 max-[799px]:gap-3.5">
          {(state.status === "error" && state.message) || state.fieldErrors?.tos ? (
            <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
              {state.message ?? state.fieldErrors?.tos}
            </p>
          ) : null}
          <UtworzKonto gotowe={gotowe} />
        </div>
      </form>

      <p className="order-5 m-0 text-center text-[13px] text-[#666666] max-[799px]:text-sm">
        Masz już konto?{" "}
        <Link href="/logowanie" className="text-[#171717] underline hover:text-black max-[799px]:font-semibold max-[799px]:no-underline">
          Zaloguj się
        </Link>
      </p>
    </div>
  );
}
