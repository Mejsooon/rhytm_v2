"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { GoogleButton } from "@/components/auth/google-button";
import { OrSeparator } from "@/components/auth/or-separator";
import { PasswordInput } from "@/components/auth/password-input";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/controls/button";
import { TextField } from "@/components/controls/field";

import { signIn, signInWithGoogle, type AuthFormState } from "./actions";

const POCZATKOWY: AuthFormState = { status: "idle" };

// Jeden formularz dla web i telefonu. Kolejność bloków: `order-*` (web) i `max-[799px]:order-*` (telefon);
// teksty różniące się wariantem to dwa <span> ukrywane klasami breakpointu.
export function LoginForm({ oauthError = false }: { oauthError?: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, POCZATKOWY);
  // E-mail trzymamy w stanie, bo React czyści pola formularza po wysłaniu akcji
  const [email, setEmail] = useState("");

  const blad =
    state.status === "error"
      ? state.message
      : oauthError
        ? "Nie udało się zalogować przez Google"
        : undefined;

  return (
    // Kontener z kolejnością bloków: `order-*` (web) i `max-[799px]:order-*` (telefon).
    // Google to osobny <form> obok formularza hasła, więc Enter w polach zawsze wysyła logowanie hasłem.
    <div className="flex flex-1 flex-col gap-4 max-[799px]:gap-3.5">
      {/* Tytuł: web „Zaloguj się do rhytm”, telefon „Witaj z powrotem” */}
      <div className="order-1 min-[800px]:mb-1 max-[799px]:mb-3.5 max-[799px]:text-center">
        <h1 className="m-0 text-xl font-semibold tracking-[-0.015em] max-[799px]:text-[28px]">
          <span className="max-[799px]:hidden">Zaloguj się do rhytm</span>
          <span className="min-[800px]:hidden">Witaj z powrotem</span>
        </h1>
        <p className="mt-1 mb-0 text-muted-foreground max-[799px]:mt-1.5 max-[799px]:text-[13px]">
          <span className="max-[799px]:hidden">
            Kalendarz, sport, nawyki i Twoje strony w jednym miejscu.
          </span>
          <span className="min-[800px]:hidden">Zaloguj się do rhytm</span>
        </p>
      </div>

      {/* Google: na webie na górze, na telefonie pod „lub” */}
      <form action={signInWithGoogle} className="order-2 max-[799px]:order-7">
        <GoogleButton />
      </form>

      <OrSeparator
        label="lub e-mailem"
        className="order-3 max-[799px]:hidden"
      />
      <OrSeparator
        label="lub"
        className="order-3 min-[800px]:hidden max-[799px]:order-6 max-[799px]:mt-3.5"
      />

      <form
        action={formAction}
        className="order-4 flex flex-col gap-4 max-[799px]:order-2 max-[799px]:gap-3.5"
      >
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
        />

        <PasswordInput
          name="password"
          label="Hasło"
          autoComplete="current-password"
          rightLink={
            <Link
              href="/reset-hasla"
              className="text-muted-foreground underline hover:text-foreground max-[799px]:text-sm max-[799px]:text-soft-foreground max-[799px]:no-underline"
            >
              Nie pamiętasz hasła?
            </Link>
          }
        />

        <TurnstileWidget resetKey={state} />

        <div className="flex flex-col gap-4 max-[799px]:mt-1 max-[799px]:gap-3.5">
          {blad && (
            <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
              {blad}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={pending}
            className="w-full leading-[1.21] max-[799px]:text-[15px]"
          >
            Zaloguj się
          </Button>
        </div>
      </form>

      <p className="order-8 m-0 text-center text-sm text-muted-foreground max-[799px]:mt-auto">
        <span className="max-[799px]:hidden">
          Nie masz konta?{" "}
          <Link
            href="/rejestracja"
            className="font-medium text-foreground underline"
          >
            Zarejestruj się
          </Link>
        </span>
        <span className="min-[800px]:hidden">
          Nie masz konta?{" "}
          <Link
            href="/rejestracja"
            className="font-semibold text-foreground no-underline"
          >
            Załóż konto
          </Link>
        </span>
      </p>
    </div>
  );
}
