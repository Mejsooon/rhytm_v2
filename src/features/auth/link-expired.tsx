"use client";

import { CircleAlert } from "lucide-react";
import { useState, useTransition } from "react";

import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/controls/button";
import { TextField } from "@/components/controls/field";

import { resendLink, type AuthFormState } from "./actions";

// Ekran „Link wygasł” (EmailConfirmed.dc.html, drugi stan): pole e-mail i „Wyślij nowy link”.
// Po wysłaniu zawsze ten sam tekst — nie zdradzamy, czy adres ma konto.
export function LinkExpired({ type }: { type: "signup" | "recovery" }) {
  const [wyslano, setWyslano] = useState(false);
  const [pending, startTransition] = useTransition();
  const [wynik, setWynik] = useState<AuthFormState>({ status: "idle" });

  return (
    <div className="flex flex-col items-center gap-4 text-center max-[799px]:mt-6">
      <span className="flex size-11 items-center justify-center rounded-md border border-border bg-panel">
        <CircleAlert
          aria-hidden="true"
          className="size-5 text-destructive-foreground"
          strokeWidth={2}
        />
      </span>
      <h1 className="m-0 text-[22px] font-semibold">Link wygasł</h1>
      <p className="m-0 leading-normal text-muted-foreground">
        Ten link jest za stary albo został już użyty. Wyślemy nowy na Twój
        adres.
      </p>
      {wyslano ? (
        <p role="status" className="m-0 leading-normal text-muted-foreground">
          Jeśli konto z tym adresem istnieje, wysłaliśmy nowy link.
        </p>
      ) : (
        <form
          className="flex w-full flex-col gap-4 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            const dane = new FormData(e.currentTarget);
            const email = String(dane.get("email") ?? "");
            const token = dane.get("cf-turnstile-response");
            startTransition(async () => {
              const odpowiedz = await resendLink(
                type,
                email,
                typeof token === "string" ? token : null,
              );
              setWynik(odpowiedz);
              if (odpowiedz.status === "success") setWyslano(true);
            });
          }}
        >
          <TextField
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ty@example.com"
            required
            className="leading-[1.21]"
            error={wynik.fieldErrors?.email}
          />
          <TurnstileWidget resetKey={wynik} />
          {wynik.status === "error" && wynik.message && (
            <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
              {wynik.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="w-full leading-[1.21] max-[799px]:text-[15px]"
          >
            Wyślij nowy link
          </Button>
        </form>
      )}
    </div>
  );
}
