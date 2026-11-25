"use client";

import { CircleAlert, Clock } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/controls/button";
import { TextField } from "@/components/controls/field";

import { resendLink, type AuthFormState } from "./actions";

// Treść ekranu „Link wygasł” (CEmailConfirmed.dc.html, prawa karta; CMEmailLink.dc.html): pole e-mail i „Wyślij nowy link”.
// Ramkę konta (AuthShell) dokłada strona; na telefonie treść jest kartą (`m-auth-card`).
// Po wysłaniu zawsze ten sam tekst — nie zdradzamy, czy adres ma konto.
export function LinkExpired({ type }: { type: "signup" | "recovery" }) {
  const [wyslano, setWyslano] = useState(false);
  const [pending, startTransition] = useTransition();
  const [wynik, setWynik] = useState<AuthFormState>({ status: "idle" });

  return (
    <div className="flex flex-col items-center gap-4 text-center max-[799px]:m-auth-card max-[799px]:gap-2 max-[799px]:px-5 max-[799px]:py-7">
      {/* Web: czerwony wykrzyknik; telefon: zegar w kolorze ostrzeżenia (.empty-ic z makiety) */}
      <span className="flex size-10 items-center justify-center rounded-[10px] border border-destructive-border bg-destructive-soft text-destructive-foreground shadow-xs max-[799px]:border-border max-[799px]:bg-white max-[799px]:text-warning-foreground">
        <CircleAlert
          aria-hidden="true"
          className="size-5 max-[799px]:hidden"
          strokeWidth={2}
        />
        <Clock
          aria-hidden="true"
          className="size-5 min-[800px]:hidden"
          strokeWidth={2}
        />
      </span>
      <h1 className="m-0 text-xl font-semibold max-[799px]:mt-2 max-[799px]:text-lg max-[799px]:tracking-[-0.011em]">
        Link wygasł
      </h1>
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
            <p
              role="alert"
              className="m-0 text-[13px] text-destructive-foreground"
            >
              {wynik.message}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="w-full leading-[1.21] max-[799px]:mt-2 max-[799px]:border-primary max-[799px]:bg-primary max-[799px]:text-primary-foreground max-[799px]:shadow-none"
          >
            Wyślij nowy link
          </Button>
        </form>
      )}
      {/* Telefon (CMEmailLink): ważność nowego linku pod przyciskiem i „Zaloguj się” (na webie ważność jest w stopce karty) */}
      <span className="text-xs text-muted-foreground min-[800px]:hidden">
        Nowy link będzie ważny 1 godzinę.
      </span>
      <Button
        asChild
        variant="ghost"
        className="w-full min-[800px]:hidden"
      >
        <Link href="/logowanie">Zaloguj się</Link>
      </Button>
    </div>
  );
}
