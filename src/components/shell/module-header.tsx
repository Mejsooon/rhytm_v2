import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";

import { Button } from "@/components/controls";
import { cn } from "@/lib/utils";

// Nagłówek modułu. Oba warianty są w DOM, przełącza je wyłącznie CSS (800 px):
// - web: .topbar z coss.css; moduły (bez webParent) pokazują sam tytuł .h-title
//   (18 px / 600), strony z webParent okruszki .crumb („Strony / Books”),
// - telefon: .m-head z makiet CM* (CMPages, CMCalendarWeek, CMSettings, CMGym):
//   [Wstecz] [.lbl nad .m-title] [akcje po prawej], wszystkie przyciski 44 px.
//
// API telefonu (dla ekranów m-*.tsx):
//   phoneTitle        inny tytuł niż na webie
//   phoneLabel        .lbl nad tytułem (12 px, 500, muted), np. „Twoje tabele i notatki”
//   phoneBack         { href, label } → link 44 px ze strzałką w lewo przed tytułem;
//                     label to dostępna nazwa („Wstecz”, „Strony”)
//   phoneCenterTitle  tytuł na środku (CMSettings, CMGym); bez akcji po prawej
//                     wstawia pusty 44 px, żeby tytuł był naprawdę na środku
//   phoneActions      węzły po prawej; każdy przycisk 44 px, najprościej
//                     <Button variant="ghost" icon aria-label="…"> albo z asChild dla <Link>
//   phoneSettingsLink ⚙ → /ustawienia jako pierwsza akcja po prawej (CMPages)
//   webOnly           ekran ma własny nagłówek telefonu (np. Dziś)
//   phoneOnly         odwrotnie: ekran ma własny nagłówek web (np. okruszki ze stronami podrzędnymi);
//                     renderuje tylko .m-head telefonu
// Przykład: <ModuleHeader title="Strony" phoneLabel="Twoje tabele i notatki" phoneSettingsLink
//             phoneActions={<Button variant="ghost" icon aria-label="Nowa strona"><Plus size={20} /></Button>} />
export function ModuleHeader({
  title,
  phoneLabel,
  phoneSettingsLink = false,
  phoneBack,
  phoneActions,
  phoneCenterTitle = false,
  webParent,
  phoneTitle,
  webMeta,
  webAction,
  webOnly = false,
  phoneOnly = false,
}: {
  title: string;
  // Pierwszy człon okruszków na webie („Ustawienia / Ogólne”); bez niego web pokazuje sam tytuł
  webParent?: string;
  // Inny tytuł na telefonie (np. „Ustawienia” zamiast nazwy zakładki)
  phoneTitle?: string;
  // Etykieta .lbl nad tytułem na telefonie
  phoneLabel?: string;
  // Ikona ⚙ → /ustawienia po prawej (CMPages), przed phoneActions
  phoneSettingsLink?: boolean;
  // Przycisk „wstecz” 44 px przed tytułem na telefonie
  phoneBack?: { href: string; label: string };
  // Akcje po prawej na telefonie (przyciski 44 px)
  phoneActions?: React.ReactNode;
  // Tytuł telefonu wyśrodkowany (CMSettings, CMGym)
  phoneCenterTitle?: boolean;
  // Dopiski tuż za tytułem na webie (CToday: odznaka z datą i „tydz. N”)
  webMeta?: React.ReactNode;
  // Akcja po prawej stronie nagłówka na webie (np. „Nowy blok”)
  webAction?: React.ReactNode;
  // Tylko nagłówek web (ekran ma własny nagłówek telefonu, np. pełne Dziś z MToday)
  webOnly?: boolean;
  // Tylko nagłówek telefonu (ekran ma własny nagłówek web, np. okruszki)
  phoneOnly?: boolean;
}) {
  const maAkcje = phoneSettingsLink || phoneActions != null;
  return (
    <>
      {/* .topbar: min-height 36 px liczone bez paddingu (box-content), padding 10px 24px */}
      {!phoneOnly && (
        <header className="box-content flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5 max-[799px]:hidden">
          <div className="flex flex-wrap items-center gap-2.5">
            {webParent ? (
              // .crumb: rodzic muted 14 px, ukośnik, tytuł 14 px / 500
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>{webParent}</span> <span>/</span>{" "}
                <h1 className="m-0 text-sm font-medium text-foreground">
                  {title}
                </h1>
              </div>
            ) : (
              // .h-title: sam tytuł modułu, bez „Moduły /”
              <h1 className="m-0 text-lg font-semibold tracking-[-0.011em]">
                {title}
              </h1>
            )}
            {webMeta}
          </div>
          {webAction && (
            <div className="flex flex-wrap items-center gap-2">{webAction}</div>
          )}
        </header>
      )}
      {!webOnly && (
        // .m-head; z etykietą padding 4 px góra/dół (CMPages), ze „wstecz” 0 8px (CMSettings, CMGym)
        <header
          className={cn(
            "m-head min-[800px]:hidden",
            phoneLabel && "py-1",
            phoneBack && "px-2",
          )}
        >
          {phoneBack && (
            <Button variant="ghost" icon asChild>
              <Link href={phoneBack.href} aria-label={phoneBack.label}>
                <ChevronLeft size={20} aria-hidden="true" />
              </Link>
            </Button>
          )}
          <div
            className={cn("min-w-0 flex-1", phoneCenterTitle && "text-center")}
          >
            {phoneLabel && (
              <div className="text-xs font-medium text-muted-foreground">
                {phoneLabel}
              </div>
            )}
            <h1 className="m-title truncate">{phoneTitle ?? title}</h1>
          </div>
          {maAkcje && (
            <div className="flex flex-none items-center gap-2">
              {phoneSettingsLink && (
                <Button variant="ghost" icon asChild>
                  <Link href="/ustawienia" aria-label="Ustawienia">
                    <Settings size={20} aria-hidden="true" />
                  </Link>
                </Button>
              )}
              {phoneActions}
            </div>
          )}
          {/* Przeciwwaga dla „wstecz”, żeby wyśrodkowany tytuł był na środku ekranu (CMSettings) */}
          {phoneCenterTitle && !maAkcje && (
            <span aria-hidden="true" className="w-11 flex-none" />
          )}
        </header>
      )}
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
