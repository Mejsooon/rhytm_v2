import Link from "next/link";
import type { ReactNode } from "react";

import { RhytmLogo } from "@/components/brand/rhytm-logo";
import { cn } from "@/lib/utils";

// Szerokość karty z literałami klas — Tailwind musi je widzieć w kodzie
const SZEROKOSC_KARTY = {
  380: "min-[800px]:max-w-[380px]",
  400: "min-[800px]:max-w-[400px]",
} as const;

// Wspólny układ ekranów konta.
// Od 800 px: tło #fafafa z siatką 48 px, nagłówek z logo i akcją, karta na środku (Login.dc.html).
// Poniżej 800 px: białe tło, bez karty i siatki, logo nad treścią (MLogin.dc.html).
// Przełączanie wyłącznie klasami CSS — bez matchMedia, żeby hydratacja nie migotała.
export function AuthShell({
  headerAction,
  width = 380,
  children,
}: {
  headerAction?: { href: string; label: string };
  width?: 380 | 400;
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
      </header>

      <main className="flex flex-1 items-center justify-center p-6 max-[799px]:items-stretch max-[799px]:p-0">
        <div
          className={cn(
            "box-content flex w-full flex-col gap-4 rounded-xl border border-[#eaeaea] bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(0,0,0,.04)]",
            SZEROKOSC_KARTY[width],
            // Telefon: bez karty, marginesy z makiety (56 / 24 / 24 px)
            "max-[799px]:box-border max-[799px]:gap-0 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:px-6 max-[799px]:pt-14 max-[799px]:pb-6 max-[799px]:shadow-none",
          )}
        >
          <RhytmLogo size={48} className="mb-3.5 justify-center min-[800px]:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
