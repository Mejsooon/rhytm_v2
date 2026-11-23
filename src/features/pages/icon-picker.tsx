"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { iconNames } from "lucide-react/dynamic";

import { Button } from "@/components/controls";

import { PageIcon } from "./page-icon";
import { parsePageIcon, searchIcons } from "./page-icons";

// Tymczasowy wybór ikony (pełny picker przepisuje Task 3): „Usuń”, wyszukiwarka i siatka ikon Lucide.
// `value` i `onPick` — tekst z `pages.icon` (`lucide:<nazwa>` albo '' po „Usuń”).
export function IconPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (v: string) => void;
}) {
  const obecna = parsePageIcon(value);
  const [fraza, setFraza] = React.useState("");

  const { names: ikony } = searchIcons(fraza, iconNames, 120);

  // Komórka siatki: 32 px, promień 8 px; zaznaczona — ramka rgba(0,0,0,.18) i tło rgba(0,0,0,.05)
  const klasaKomorki = (zaznaczona: boolean) =>
    `flex h-8 cursor-pointer items-center justify-center rounded-[8px] p-0 text-lg leading-none outline-none focus-visible:shadow-focus max-[799px]:h-11 ${
      zaznaczona ? "border border-black/[.18] bg-black/5" : "border border-transparent bg-transparent hover:bg-black/[.04]"
    }`;

  // role="group": dymek wokół (ActionPopover / arkusz) już jest oknem
  return (
    <div role="group" aria-label="Wybór ikony" className="box-border flex w-full flex-col gap-2 text-sm text-foreground">
      <div className="flex items-center gap-2">
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onPick("")}
          className="text-muted-foreground max-[799px]:h-11"
        >
          Usuń
        </Button>
      </div>

      {/* .igroup: lupa i pole w jednej ramce */}
      <label className="box-border flex h-8 items-center gap-2 rounded-md border border-input bg-white bg-clip-padding px-[11px] text-muted-foreground shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo max-[799px]:h-11">
        <Search size={16} aria-hidden="true" className="flex-none" />
        <input
          type="text"
          value={fraza}
          onChange={(e) => setFraza(e.target.value)}
          placeholder="Szukaj ikony…"
          aria-label="Szukaj ikony"
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-sm text-foreground outline-none placeholder:text-faint-foreground max-[799px]:text-[15px]"
        />
      </label>

      <div className="-mx-0.5 max-h-[236px] overflow-y-auto px-0.5">
        <div className="grid grid-cols-8 gap-0.5">
          {ikony.map((nazwa) => (
            <button
              key={nazwa}
              type="button"
              aria-label={`Ikona ${nazwa}`}
              aria-pressed={obecna === nazwa}
              onClick={() => onPick(`lucide:${nazwa}`)}
              className={klasaKomorki(obecna === nazwa)}
            >
              <PageIcon icon={`lucide:${nazwa}`} size={18} />
            </button>
          ))}
        </div>
        {ikony.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-2 py-4 text-center">
            <span className="text-sm font-medium">Brak wyników</span>
            <span className="text-xs font-normal text-muted-foreground">Spróbuj innego słowa.</span>
          </div>
        )}
      </div>
    </div>
  );
}
