import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/controls/button";

export const metadata: Metadata = { title: "E-mail potwierdzony — rhytm" };

// Stan „E-mail potwierdzony” (CEmailConfirmed.dc.html, lewa karta). Statyczny — do /onboarding prowadzi zwykły link.
export default function PotwierdzonoPage() {
  return (
    <AuthShell
      headerAction={{ href: "/logowanie", label: "Zaloguj się" }}
      // Makieta telefonu (CMEmailLink) nie ma stopki
      footerWebOnly
      footer={<span className="text-xs">Link był jednorazowy i już wygasł.</span>}
    >
      {/* Telefon: karta `.empty` (m-auth-card), ikona w neutralnym kafelku z zielonym „ptaszkiem” */}
      <div className="flex flex-col items-center gap-4 text-center max-[799px]:m-auth-card max-[799px]:gap-2 max-[799px]:px-5 max-[799px]:py-7">
        <span className="flex size-10 items-center justify-center rounded-[10px] border border-success-border bg-success-soft text-success shadow-xs max-[799px]:border-border max-[799px]:bg-white">
          <Check aria-hidden="true" className="size-5" strokeWidth={2} />
        </span>
        <h1 className="m-0 text-xl font-semibold max-[799px]:mt-2 max-[799px]:text-lg max-[799px]:tracking-[-0.011em]">
          E-mail potwierdzony
        </h1>
        <p className="m-0 leading-normal text-muted-foreground">
          Konto jest aktywne. Za chwilę ustawimy profil i cele, zajmie to około
          minuty.
        </p>
        <Button
          asChild
          variant="primary"
          size="lg"
          className="w-full leading-[1.21] max-[799px]:mt-2"
        >
          <Link href="/onboarding">Dalej</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
