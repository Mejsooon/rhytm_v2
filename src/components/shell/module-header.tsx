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
  webParent = "Moduły",
  phoneTitle,
  webAction,
}: {
  title: string;
  // Pierwszy człon ścieżki na webie („Ustawienia / Ogólne”)
  webParent?: string;
  // Inny tytuł na telefonie (np. „Ustawienia” zamiast nazwy zakładki)
  phoneTitle?: string;
  // Etykieta mono nad dużym tytułem na telefonie
  phoneLabel?: string;
  // Ikona ⚙ → /ustawienia po prawej (MPages)
  phoneSettingsLink?: boolean;
  // Akcja po prawej stronie nagłówka na webie (np. „Nowy blok”)
  webAction?: React.ReactNode;
}) {
  return (
    <>
      <header className="flex min-h-[34px] items-center gap-3 border-b border-border px-6 py-3 max-[799px]:hidden">
        <div className="font-mono text-[13px] text-muted-foreground">
          <span>{webParent}</span> <span className="text-faint-foreground">/</span>{" "}
          {/* Tytuł modułu jest nagłówkiem strony na webie; wygląda jak reszta ścieżki (h1 w linii, te same style) */}
          <h1 className="inline text-foreground">{title}</h1>
        </div>
        {webAction && (
          <div className="ml-auto flex items-center gap-2">{webAction}</div>
        )}
      </header>
      <header className="flex min-h-[60px] items-center gap-1 pt-2 pr-2 pb-1 pl-4 min-[800px]:hidden">
        <div className="min-w-0 flex-1">
          {phoneLabel && <MonoLabel className="block">{phoneLabel}</MonoLabel>}
          <h1 className="mt-0.5 text-[28px] font-semibold tracking-[-0.02em]">
            {phoneTitle ?? title}
          </h1>
        </div>
        {phoneSettingsLink && (
          <Link
            href="/ustawienia"
            aria-label="Ustawienia"
            className="inline-flex size-11 flex-none items-center justify-center rounded-md text-foreground hover:bg-muted"
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
    <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
