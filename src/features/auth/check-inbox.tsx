"use client";

import { Check, Mail } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/controls/button";

// Stan „Sprawdź skrzynkę”: ikona, tekst, „Wyślij ponownie” z odliczaniem.
// kind="signup" — Register.dc.html (koperta, tekst o potwierdzeniu);
// kind="reset" — Forgot.dc.html / MForgot.dc.html (zielony „ptaszek” tylko na telefonie, własny tekst i slot `before`).
export function CheckInbox({
  onResend,
  cooldownSeconds = 60,
  kind = "signup",
  description,
  before,
}: {
  // Adres jest częścią kontraktu komponentu, ale makieta go nie pokazuje — nie renderujemy go
  email?: string;
  onResend: () => Promise<void>;
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

  async function ponownie() {
    await onResend();
    setPozostalo(cooldownSeconds);
  }

  const licznik = `${Math.floor(pozostalo / 60)}:${String(pozostalo % 60).padStart(2, "0")}`;
  const reset = kind === "reset";

  return (
    <div
      className={
        reset
          ? "flex flex-col items-center gap-4 text-center max-[799px]:mt-0 max-[799px]:gap-[22px] max-[799px]:pt-10"
          : "flex flex-col items-center gap-3.5 text-center max-[799px]:mt-6"
      }
    >
      {reset ? (
        <span className="flex size-16 items-center justify-center rounded-[18px] border border-[#bbe5cc] bg-[#f0faf4] text-[#15803d] min-[800px]:hidden">
          <Check aria-hidden="true" className="size-[30px]" strokeWidth={2} />
        </span>
      ) : (
        <span className="flex size-11 items-center justify-center rounded-[10px] border border-[#eaeaea] bg-[#fafafa]">
          <Mail aria-hidden="true" className="size-5 text-[#171717]" strokeWidth={2} />
        </span>
      )}
      <div className={reset ? "flex flex-col items-center gap-4 max-[799px]:gap-3.5" : "contents"}>
        <h1 className={reset ? "m-0 text-xl font-semibold max-[799px]:text-2xl max-[799px]:tracking-[-0.02em]" : "m-0 text-xl font-semibold"}>
          Sprawdź skrzynkę
        </h1>
        <p className={reset ? "m-0 leading-normal text-[#666666] max-[799px]:max-w-[280px] max-[799px]:text-[13px] max-[799px]:leading-normal" : "m-0 leading-normal text-[#666666]"}>
          {description ?? "Jeśli adres jest poprawny, wysłaliśmy na niego link potwierdzający. Link wygasa po 1 godzinie."}
        </p>
      </div>
      {before}
      <Button
        type="button"
        disabled={pozostalo > 0}
        onClick={ponownie}
        className={reset ? "px-3 py-2 font-normal max-[799px]:w-full max-[799px]:border-0" : "px-3 py-2 font-normal"}
      >
        Wyślij ponownie
        {pozostalo > 0 && <span className="font-mono text-[#6b6b6b]">{licznik}</span>}
      </Button>
    </div>
  );
}
