"use client";

import { CircleAlert } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/controls/button";
import { TextField } from "@/components/controls/field";

import { resendLink } from "./actions";

// Ekran „Link wygasł” (EmailConfirmed.dc.html, drugi stan): pole e-mail i „Wyślij nowy link”.
// Po wysłaniu zawsze ten sam tekst — nie zdradzamy, czy adres ma konto.
export function LinkExpired({ type }: { type: "signup" | "recovery" }) {
  const [wyslano, setWyslano] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-center gap-4 text-center max-[799px]:mt-6">
      <span className="flex size-11 items-center justify-center rounded-[10px] border border-[#eaeaea] bg-[#fafafa]">
        <CircleAlert aria-hidden="true" className="size-5 text-[#b91c1c]" strokeWidth={2} />
      </span>
      <h1 className="m-0 text-[22px] font-semibold">Link wygasł</h1>
      <p className="m-0 leading-normal text-[#666666]">
        Ten link jest za stary albo został już użyty. Wyślemy nowy na Twój adres.
      </p>
      {wyslano ? (
        <p role="status" className="m-0 leading-normal text-[#666666]">
          Jeśli konto z tym adresem istnieje, wysłaliśmy nowy link.
        </p>
      ) : (
        <form
          className="flex w-full flex-col gap-4 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            const email = String(new FormData(e.currentTarget).get("email") ?? "");
            startTransition(async () => {
              await resendLink(type, email);
              setWyslano(true);
            });
          }}
        >
          <TextField label="E-mail" name="email" type="email" autoComplete="email" placeholder="ty@example.com" required className="leading-[1.21]" />
          <Button type="submit" disabled={pending} className="w-full leading-[1.21] max-[799px]:text-[15px]">
            Wyślij nowy link
          </Button>
        </form>
      )}
    </div>
  );
}
