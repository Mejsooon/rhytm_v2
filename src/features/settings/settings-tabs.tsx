import Link from "next/link";

import { cn } from "@/lib/utils";

export const SETTINGS_TABS: readonly {
  slug: "ogolne" | "konto" | "sejf" | "powiadomienia" | "kategorie";
  label: string;
  description?: string;
  // Opis pod nazwą w indeksie ustawień na telefonie (CMSettings, `.hint`)
  phoneHint: string;
}[] = [
  {
    slug: "ogolne",
    label: "Ogólne",
    description: "Profil, cele i podstawowe preferencje aplikacji.",
    phoneHint: "Profil, cele, konto, kosz",
  },
  {
    slug: "konto",
    label: "Konto i bezpieczeństwo",
    phoneHint: "Hasło do konta, sesje, eksport danych",
  },
  {
    slug: "sejf",
    label: "Sejf",
    phoneHint: "Hasło główne do modułu Hasła",
  },
  {
    slug: "powiadomienia",
    label: "Powiadomienia",
    phoneHint: "Push, cicha noc, urządzenia",
  },
  {
    slug: "kategorie",
    label: "Kategorie kalendarza",
    phoneHint: "Kolory i kolejność kategorii",
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
      {SETTINGS_TABS.map((tab) => {
        const aktywna = tab.slug === active;
        return (
          <Link
            key={tab.slug}
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
        );
      })}
    </nav>
  );
}
