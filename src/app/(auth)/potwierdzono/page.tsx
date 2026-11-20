import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/controls/button";

export const metadata: Metadata = { title: "E-mail potwierdzony — rhytm" };

// Stan „E-mail potwierdzony” (EmailConfirmed.dc.html). Statyczny — do /onboarding prowadzi zwykły link.
export default function PotwierdzonoPage() {
  return (
    <AuthShell
      headerAction={{ href: "/logowanie", label: "Zaloguj się" }}
      width={362}
    >
      <div className="flex flex-col items-center gap-4 text-center max-[799px]:mt-6">
        <span className="flex size-11 items-center justify-center rounded-md border border-border bg-panel">
          <Check
            aria-hidden="true"
            className="size-5 text-success"
            strokeWidth={2}
          />
        </span>
        <h1 className="m-0 text-[22px] font-semibold">E-mail potwierdzony</h1>
        <p className="m-0 leading-normal text-muted-foreground">
          Konto jest aktywne. Za chwilę ustawimy profil i cele, zajmie to około
          minuty.
        </p>
        <Button
          asChild
          variant="primary"
          className="w-full leading-[1.21] max-[799px]:text-[15px]"
        >
          <Link href="/onboarding">Dalej</Link>
        </Button>
        <p className="m-0 font-mono text-[11px] text-muted-foreground">
          Link był jednorazowy i już wygasł.
        </p>
      </div>
    </AuthShell>
  );
}
