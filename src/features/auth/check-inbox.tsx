"use client";

import { Check, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/controls/button";
import { cn } from "@/lib/utils";

import type { AuthFormState } from "./actions";

// Stan „Sprawdź skrzynkę”: ikona, tekst, „Wyślij ponownie” z odliczaniem.
// kind="signup" — CRegister.dc.html / CMCheckEmail.dc.html (koperta, tekst o potwierdzeniu);
// kind="reset" — CForgot.dc.html / CMForgot.dc.html (na telefonie zielony „ptaszek” w kafelku, własny tekst i slot `before`).
// Na telefonie treść jest kartą `.empty` (m-auth-card), stąd klasy `max-[799px]:`.
export function CheckInbox({
  onResend,
  cooldownSeconds = 60,
  kind = "signup",
  description,
  before,
}: {
  // Adres jest częścią kontraktu komponentu, ale makieta go nie pokazuje — nie renderujemy go
  email?: string;
  // Token Turnstile (niewidoczny widżet w formularzu „Wyślij ponownie”) — serwer wymaga go przy każdym wysłaniu.
  // Zwraca wynik akcji: przy błędzie pokazujemy komunikat, a licznik nie startuje od nowa.
  onResend: (turnstileToken: string | null) => Promise<AuthFormState>;
  cooldownSeconds?: number;
  kind?: "signup" | "reset";
  // Własny opis zamiast domyślnego tekstu o linku potwierdzającym
  description?: ReactNode;
  // Element między opisem a „Wyślij ponownie” (np. „Wróć do logowania”)
  before?: ReactNode;
}) {
  // Licznik startuje od razu — link właśnie wysłano
  const [pozostalo, setPozostalo] = useState(cooldownSeconds);

  useEffect(() => {
    if (pozostalo <= 0) return;
    const t = setTimeout(() => setPozostalo((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [pozostalo]);

  // Token jednorazowy: po każdym wysłaniu widżet dostaje nowy resetKey
  const [odnowienia, setOdnowienia] = useState(0);
  // W trakcie wysyłania przycisk jest zablokowany (bez podwójnego żądania)
  const [wysylanie, setWysylanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function ponownie(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (wysylanie) return;
    const token = new FormData(e.currentTarget).get("cf-turnstile-response");
    setWysylanie(true);
    setBlad(null);
    try {
      const wynik = await onResend(typeof token === "string" ? token : null);
      if (wynik.status === "success") {
        setPozostalo(cooldownSeconds);
      } else {
        setBlad(
          wynik.message ??
            wynik.fieldErrors?.email ??
            "Nie udało się wysłać. Spróbuj ponownie.",
        );
      }
    } catch {
      setBlad("Nie udało się wysłać. Spróbuj ponownie.");
    } finally {
      setWysylanie(false);
      setOdnowienia((n) => n + 1);
    }
  }

  const licznik = `${Math.floor(pozostalo / 60)}:${String(pozostalo % 60).padStart(2, "0")}`;
  const reset = kind === "reset";

  return (
    <div className="flex flex-col items-center gap-3.5 text-center max-[799px]:m-auth-card max-[799px]:gap-2 max-[799px]:px-5 max-[799px]:py-7">
      {/* Kafelek ikony 40 px (.empty-ic z makiet); w resecie na telefonie zielony „ptaszek” zamiast koperty */}
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-[10px] border border-border bg-white text-muted-foreground shadow-xs",
          reset && "max-[799px]:text-success",
        )}
      >
        <Mail
          aria-hidden="true"
          className={cn("size-5", reset && "max-[799px]:hidden")}
          strokeWidth={2}
        />
        {reset && (
          <Check
            aria-hidden="true"
            className="size-5 min-[800px]:hidden"
            strokeWidth={2}
          />
        )}
      </span>
      <h1 className="m-0 text-xl font-semibold max-[799px]:mt-2 max-[799px]:text-lg max-[799px]:tracking-[-0.011em]">
        Sprawdź skrzynkę
      </h1>
      <p className="m-0 leading-normal text-muted-foreground max-[799px]:max-w-[290px]">
        {description ??
          "Jeśli adres jest poprawny, wysłaliśmy na niego link potwierdzający. Link wygasa po 1 godzinie."}
      </p>
      {before}
      <form
        onSubmit={ponownie}
        className="flex flex-col items-center max-[799px]:w-full"
      >
        <TurnstileWidget resetKey={odnowienia} />
        <Button
          type="submit"
          disabled={pozostalo > 0 || wysylanie}
          className="max-[799px]:w-full max-[799px]:border-transparent max-[799px]:bg-transparent max-[799px]:shadow-none"
        >
          Wyślij ponownie
          {pozostalo > 0 && (
            // Na telefonie licznik jako plakietka `bdg sec num` (CMCheckEmail)
            <span className="tabular-nums text-muted-foreground max-[799px]:inline-flex max-[799px]:h-[18px] max-[799px]:items-center max-[799px]:rounded-sm max-[799px]:bg-muted max-[799px]:px-[5px] max-[799px]:text-xs max-[799px]:text-foreground">
              {licznik}
            </span>
          )}
        </Button>
        {blad && (
          <p role="alert" className="m-0 mt-2 text-[13px] text-destructive-foreground">
            {blad}
          </p>
        )}
      </form>
    </div>
  );
}
