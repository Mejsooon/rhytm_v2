import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { RhytmLogo } from "@/components/brand/rhytm-logo";
import { cn } from "@/lib/utils";

// Szerokość karty z literałami klas — Tailwind musi je widzieć w kodzie
const SZEROKOSC_KARTY = {
  380: "min-[800px]:max-w-[380px]",
  400: "min-[800px]:max-w-[400px]",
  // Karty z makiet Forgot / EmailConfirmed mają box-sizing: border-box (380 / 420 px łącznie z ramką i paddingiem 28)
  322: "min-[800px]:max-w-[322px]",
  362: "min-[800px]:max-w-[362px]",
} as const;

// Wspólny układ ekranów konta.
// Od 800 px: tło #fafafa z siatką 48 px, nagłówek z logo i akcją, karta na środku (Login.dc.html).
// Poniżej 800 px: białe tło, bez karty i siatki, logo nad treścią (MLogin.dc.html).
// Przełączanie wyłącznie klasami CSS — bez matchMedia, żeby hydratacja nie migotała.
export function AuthShell({
  headerAction,
  headerNote,
  width = 380,
  phoneBack,
  children,
}: {
  headerAction?: { href: string; label: string };
  // Web: mała etykieta mono po prawej zamiast akcji, np. „krok 1 / 3” (Forgot.dc.html)
  headerNote?: string;
  // Telefon: zamiast logo nagłówek ze strzałką „Wstecz” (MRegister.dc.html)
  phoneBack?: string;
  width?: keyof typeof SZEROKOSC_KARTY;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-white text-sm leading-[1.21] text-[#171717] min-[800px]:bg-[#fafafa] min-[800px]:bg-[linear-gradient(#eeeeee_1px,transparent_1px),linear-gradient(90deg,#eeeeee_1px,transparent_1px)] min-[800px]:bg-[length:48px_48px]">
      <header className="flex items-center justify-between px-6 py-4 max-[799px]:hidden">
        <RhytmLogo size={26} withWordmark />
        {headerAction && (
          <Link
            href={headerAction.href}
            className="rounded-md border border-[#e0e0e0] bg-white px-3 py-1.5 text-[#171717] no-underline hover:text-black"
          >
            {headerAction.label}
          </Link>
        )}
        {headerNote && (
          <span className="font-mono text-xs text-[#6b6b6b]">{headerNote}</span>
        )}
      </header>

      {phoneBack && (
        <header className="box-border flex min-h-[60px] flex-none items-center gap-1 p-2 min-[800px]:hidden">
          <Link
            href={phoneBack}
            aria-label="Wstecz"
            className="inline-flex size-11 items-center justify-center rounded-[10px] text-[#171717] hover:bg-[#f5f5f5]"
          >
            <ChevronLeft
              aria-hidden="true"
              className="size-[22px]"
              strokeWidth={2}
            />
          </Link>
        </header>
      )}

      <main className="flex flex-1 items-center justify-center p-6 max-[799px]:items-stretch max-[799px]:p-0">
        <div
          className={cn(
            "box-content flex w-full flex-col gap-4 rounded-xl border border-[#eaeaea] bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(0,0,0,.04)]",
            SZEROKOSC_KARTY[width],
            // Telefon: bez karty, marginesy z makiety (56 / 24 / 24 px)
            "max-[799px]:box-border max-[799px]:gap-0 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:px-6 max-[799px]:pb-6 max-[799px]:shadow-none",
            phoneBack ? "max-[799px]:pt-2" : "max-[799px]:pt-14",
          )}
        >
          {!phoneBack && (
            <RhytmLogo
              size={48}
              className="mb-3.5 justify-center min-[800px]:hidden"
            />
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
