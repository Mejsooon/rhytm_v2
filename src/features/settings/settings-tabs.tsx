import { Fragment } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export const SETTINGS_TABS: readonly {
  slug: "ogolne" | "konto" | "sejf" | "powiadomienia" | "kalendarz";
  // Nagłówek grupy w nawigacji (S2Settings): „Konto” albo „Moduły”
  group: "Konto" | "Moduły";
  label: string;
  description: string;
  // Opis pod nazwą w indeksie ustawień na telefonie (CMSettings, `.hint`)
  phoneHint: string;
}[] = [
  {
    slug: "ogolne",
    group: "Konto",
    label: "Ogólne",
    description: "Profil i cele aplikacji.",
    phoneHint: "Profil, cele, kosz",
  },
  {
    slug: "konto",
    group: "Konto",
    label: "Konto i bezpieczeństwo",
    description: "E-mail, hasło, zalogowane urządzenia i Twoje dane.",
    phoneHint: "E-mail, hasło, sesje, eksport, usunięcie konta",
  },
  {
    slug: "powiadomienia",
    group: "Konto",
    label: "Powiadomienia",
    description: "Co, kiedy i na którym urządzeniu ma Ci przypominać.",
    phoneHint: "Push, cicha noc, urządzenia",
  },
  {
    slug: "kalendarz",
    group: "Moduły",
    label: "Kalendarz",
    description: "Domyślny widok, siatka godzin i kategorie bloków.",
    phoneHint: "Widok, godziny i kategorie",
  },
  {
    slug: "sejf",
    group: "Moduły",
    label: "Sejf",
    description: "Blokada i hasło główne modułu Hasła.",
    phoneHint: "Blokada i hasło główne",
  },
];

export type SettingsTabSlug = (typeof SETTINGS_TABS)[number]["slug"];

// Zakładki ustawień: kolumna po lewej na webie. Na telefonie ukryte — zakładki są wierszami indeksu /ustawienia
// (MSettingsIndex), a każda zakładka to podstrona z przyciskiem „Wstecz”
export function SettingsTabs({ active }: { active: SettingsTabSlug }) {
  return (
    <nav
      aria-label="Sekcje ustawień"
      className="flex flex-col gap-0.5 min-[800px]:w-[180px] min-[800px]:flex-none max-[799px]:hidden"
    >
      {SETTINGS_TABS.map((tab, i) => {
        const aktywna = tab.slug === active;
        return (
          <Fragment key={tab.slug}>
            {SETTINGS_TABS[i - 1]?.group !== tab.group && (
              <span className="px-2.5 pt-3 pb-1 text-xs font-medium text-muted-foreground first:pt-0">
                {tab.group}
              </span>
            )}
          <Link
            href={`/ustawienia/${tab.slug}`}
            aria-current={aktywna ? "page" : undefined}
            className={cn(
              "flex items-center rounded-lg px-2.5 whitespace-nowrap font-medium no-underline min-[800px]:h-8",
              aktywna
                ? "bg-active text-foreground"
                : "text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
