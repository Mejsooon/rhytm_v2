"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/controls/button";

import {
  checkPasswordLeak,
  updatePassword,
  type AuthFormState,
} from "./actions";
import { PasswordRulesList, type LeakStatus } from "./password-rules-list";

const POCZATKOWY: AuthFormState = { status: "idle" };

function Zapisz() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending}
      className="w-full leading-[1.21] max-[799px]:text-[15px]"
    >
      Zapisz i zaloguj się
    </Button>
  );
}

// Krok 3 resetu hasła (Forgot.dc.html): nowe hasło z regułami i notką o sejfie. Układ telefonu — te same pola, klasy breakpointów.
export function NewPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, POCZATKOWY);
  const [password, setPassword] = useState("");
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

  const blad =
    state.message ?? state.fieldErrors?.password ?? state.fieldErrors?.confirm;

  return (
    <form action={formAction} className="flex flex-col gap-4 max-[799px]:gap-5">
      <div>
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em] max-[799px]:text-[28px]">
          Ustaw nowe hasło
        </h1>
        <p className="mt-1.5 mb-0 text-muted-foreground max-[799px]:text-[13px]">
          Po zmianie wylogujemy Cię z innych urządzeń.
        </p>
      </div>

      <div className="flex flex-col">
        <PasswordInput
          name="password"
          label="Nowe hasło"
          autoComplete="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setLeak("unknown");
          }}
        />
        <PasswordRulesList password={password} leak={leak} className="mt-2.5" />
      </div>
      <PasswordInput
        name="confirm"
        label="Powtórz hasło"
        autoComplete="new-password"
      />

      <p className="m-0 rounded-md border border-border bg-panel px-3 py-2.5 font-mono text-xs leading-normal text-muted-foreground">
        Hasło do konta nie otwiera sejfu. Sejf ma osobne hasło główne.
      </p>

      {blad && (
        <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
          {blad}
        </p>
      )}
      <Zapisz />
    </form>
  );
}
