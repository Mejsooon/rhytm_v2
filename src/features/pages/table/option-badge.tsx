import * as React from "react";

import type { FieldOption } from "../fields";

// Kolory plakietek (dane wybrane przez użytkownika — zostają jak są): tekst → tło; inne kolory dostają półprzezroczyste tło.
// Kształt jak .bdg z coss.css (18 px, promień 6 px, bez widocznej ramki).
// Szary z palety (#525252) ma tekst #404040 jak plakietki w Books / Projects.dc.html
const TLA_PLAKIETEK: Record<string, { tlo: string; tekst?: string }> = {
  "#404040": { tlo: "#f5f5f5" },
  "#525252": { tlo: "#f5f5f5", tekst: "#404040" },
  "#0070f3": { tlo: "#eef5ff" },
  "#15803d": { tlo: "#f0faf4" },
  "#c2410c": { tlo: "#fff4ed" },
  "#7c3aed": { tlo: "#f5f3ff" },
  "#b91c1c": { tlo: "#fef2f2" },
};

// Kolorowa plakietka opcji Wyboru (BADGE z EmptyPage.dc.html)
export function OptionBadge({
  option,
  children,
}: {
  option: FieldOption;
  children?: React.ReactNode;
}) {
  // Bez koloru: szara plakietka z obrysem (jak odznaka outline)
  if (option.color === "") {
    return (
      <span className="inline-flex h-[18px] items-center justify-center gap-1 rounded-sm border border-input bg-white px-[5px] text-xs leading-none font-medium whitespace-nowrap text-[#404040]">
        {option.label}
        {children}
      </span>
    );
  }
  const kolor = option.color.toLowerCase();
  const tlo = TLA_PLAKIETEK[kolor] ?? { tlo: `${option.color}14` };
  return (
    <span
      className="inline-flex h-[18px] items-center justify-center gap-1 rounded-sm border border-transparent px-[5px] text-xs leading-none font-medium whitespace-nowrap"
      style={{ color: tlo.tekst ?? option.color, background: tlo.tlo }}
    >
      {option.label}
      {children}
    </span>
  );
}
