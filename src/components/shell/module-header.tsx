import * as React from "react";
import Link from "next/link";
import { Settings } from "lucide-react";

import { MonoLabel } from "@/components/controls";

// Nagłówek modułu. Oba warianty są w DOM, przełącza je wyłącznie CSS (800 px):
// - web: .topbar z coss.css (CToday.dc.html) — sam tytuł .h-title 18 px / 600 jako h1;
//   z `webParent` okruszki .crumb jak w CPageMenu.dc.html („Strony / Books”, h1 14 px / 500),
// - telefon: duży tytuł 28 px z etykietą mono nad nim (MToday / MPages).
export function ModuleHeader({
  title,
  phoneLabel,
  phoneSettingsLink = false,
  webParent,
  phoneTitle,
  webAction,
}: {
  title: string;
  // Pierwszy człon okruszków na webie („Ustawienia / Ogólne”); bez niego sam tytuł modułu
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
      {/* .topbar: min-height 36 px liczone bez paddingu (box-content), padding 10px 24px */}
      <header className="box-content flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5 max-[799px]:hidden">
        {webParent ? (
          // .crumb: rodzic muted 14 px, ukośnik, tytuł 14 px / 500
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>{webParent}</span> <span>/</span>{" "}
            <h1 className="m-0 text-sm font-medium text-foreground">{title}</h1>
          </div>
        ) : (
          // .h-title
          <h1 className="m-0 text-lg font-semibold tracking-[-0.011em] text-foreground">
            {title}
          </h1>
        )}
        {webAction && (
          <div className="flex flex-wrap items-center gap-2">{webAction}</div>
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
