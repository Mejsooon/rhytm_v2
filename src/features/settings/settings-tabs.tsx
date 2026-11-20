import Link from "next/link";

import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
  { slug: "ogolne", label: "Ogólne" },
  { slug: "konto", label: "Konto i bezpieczeństwo" },
  { slug: "sejf", label: "Sejf" },
  { slug: "powiadomienia", label: "Powiadomienia" },
  { slug: "kategorie", label: "Kategorie kalendarza" },
] as const;

export type SettingsTabSlug = (typeof SETTINGS_TABS)[number]["slug"];

// Zakładki ustawień: na webie kolumna po lewej, na telefonie poziomy pasek z przewijaniem
export function SettingsTabs({ active }: { active: SettingsTabSlug }) {
  return (
    <nav
      aria-label="Sekcje ustawień"
      className="flex flex-col gap-0.5 min-[800px]:w-[180px] min-[800px]:flex-none max-[799px]:-mx-6 max-[799px]:flex-row max-[799px]:gap-1.5 max-[799px]:overflow-x-auto max-[799px]:px-6"
    >
      {SETTINGS_TABS.map((tab) => {
        const aktywna = tab.slug === active;
        return (
          <Link
            key={tab.slug}
            href={`/ustawienia/${tab.slug}`}
            aria-current={aktywna ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-[7px] whitespace-nowrap no-underline max-[799px]:flex max-[799px]:min-h-11 max-[799px]:flex-none max-[799px]:items-center max-[799px]:px-3.5",
              aktywna
                ? "bg-active font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
