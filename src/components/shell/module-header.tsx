import * as React from "react";
import Link from "next/link";
import { Settings } from "lucide-react";

import { MonoLabel } from "@/components/controls";

// Nagłówek modułu. Oba warianty są w DOM, przełącza je wyłącznie CSS (800 px):
// - web: „Moduły / Tytuł” w Geist Mono 13 px (EmptyToday.dc.html), „Tytuł” to h1,
// - telefon: duży tytuł 28 px z etykietą mono nad nim (MToday / MPages).
export function ModuleHeader({
  title,
  phoneLabel,
  phoneSettingsLink = false,
}: {
  title: string;
  // Etykieta mono nad dużym tytułem na telefonie
  phoneLabel?: string;
  // Ikona ⚙ → /ustawienia po prawej (MPages)
  phoneSettingsLink?: boolean;
}) {
  return (
    <>
      <header className="flex min-h-[34px] items-center gap-3 border-b border-[#eaeaea] px-6 py-3 max-[799px]:hidden">
        <div className="font-mono text-[13px] text-[#666666]">
          <span>Moduły</span> <span className="text-[#b0b0b0]">/</span>{" "}
          {/* Tytuł modułu jest nagłówkiem strony na webie; wygląda jak reszta ścieżki (h1 w linii, te same style) */}
          <h1 className="inline text-[#171717]">{title}</h1>
        </div>
      </header>
      <header className="flex min-h-[60px] items-center gap-1 pt-2 pr-2 pb-1 pl-4 min-[800px]:hidden">
        <div className="min-w-0 flex-1">
          {phoneLabel && <MonoLabel className="block">{phoneLabel}</MonoLabel>}
          <h1 className="mt-0.5 text-[28px] font-semibold tracking-[-0.02em]">{title}</h1>
        </div>
        {phoneSettingsLink && (
          <Link
            href="/ustawienia"
            aria-label="Ustawienia"
            className="inline-flex size-11 flex-none items-center justify-center rounded-[10px] text-[#171717] hover:bg-[#f5f5f5]"
          >
            <Settings size={21} aria-hidden="true" />
          </Link>
        )}
      </header>
    </>
  );
}

// Prosty pusty stan modułu — treść dopiszą kolejne etapy
export function EmptyModule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-[#666666]">
      {children}
    </div>
  );
}
