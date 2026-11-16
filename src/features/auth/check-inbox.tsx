"use client";

import { Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/controls/button";

// Stan „Sprawdź skrzynkę” (Register.dc.html): ikona koperty, tekst, „Wyślij ponownie” z odliczaniem.
export function CheckInbox({
  email,
  onResend,
  cooldownSeconds = 60,
}: {
  email: string;
  onResend: () => Promise<void>;
  cooldownSeconds?: number;
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

  return (
    <div className="flex flex-col items-center gap-3.5 text-center max-[799px]:mt-6">
      <span className="flex size-11 items-center justify-center rounded-[10px] border border-[#eaeaea] bg-[#fafafa]">
        <Mail aria-hidden="true" className="size-5 text-[#171717]" strokeWidth={2} />
      </span>
      <h1 className="m-0 text-xl font-semibold">Sprawdź skrzynkę</h1>
      <p className="m-0 leading-normal text-[#666666]">
        Jeśli adres jest poprawny, wysłaliśmy na niego link potwierdzający. Link wygasa po 1 godzinie.
      </p>
      <p className="m-0 font-mono text-xs break-all text-[#6b6b6b]">{email}</p>
      <Button type="button" disabled={pozostalo > 0} onClick={ponownie} className="px-3 py-2 font-normal">
        Wyślij ponownie
        {pozostalo > 0 && <span className="font-mono text-[#6b6b6b]">{licznik}</span>}
      </Button>
    </div>
  );
}
