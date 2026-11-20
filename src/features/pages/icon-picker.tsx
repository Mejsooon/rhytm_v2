"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/controls";

import { PageIcon } from "./page-icon";
import {
  EMOJI,
  ICON_COLORS,
  ICON_NAMES,
  matchesIconQuery,
  parsePageIcon,
  serializePageIcon,
  type IconColor,
} from "./page-icons";

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

// Wybór ikony strony jak w Notion (CIconPicker.dc.html): zakładki „Emoji” / „Ikony” (.seg), „Usuń”,
// wyszukiwarka (działa też bez polskich znaków), 8 kolorów ikon i siatka 8 kolumn.
// Etykiety przycisków: dwa pierwsze słowa kluczy (unikalne, np. „Emoji jedzenie dieta” / „Emoji jedzenie pizza”).
// `value` i `onPick` — tekst z `pages.icon` (emoji, `lucide:<nazwa>:<kolor>` albo '' po „Usuń”).
export function IconPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (v: string) => void;
}) {
  const obecna = parsePageIcon(value);
  const [zakladka, setZakladka] = React.useState<"emoji" | "icons">(
    obecna?.kind === "icon" ? "icons" : "emoji",
  );
  const [kolor, setKolor] = React.useState<IconColor>(
    obecna?.kind === "icon" ? obecna.color : "gray",
  );
  const [fraza, setFraza] = React.useState("");

  const emoji = EMOJI.filter(([, slowa]) => matchesIconQuery(slowa, fraza));
  const ikony = ICON_NAMES.filter(([, slowa]) => matchesIconQuery(slowa, fraza));
  const pusto = (zakladka === "emoji" ? emoji.length : ikony.length) === 0;

  // Przycisk .seg: 28 px, promień 8 px; wybrany — biała pigułka z cieniem (telefon 44 px — cel dotykowy)
  const klasaZakladki = (wlaczona: boolean) =>
    `inline-flex h-7 cursor-pointer items-center justify-center rounded-[8px] border-0 px-2.5 font-[inherit] text-sm font-medium whitespace-nowrap outline-none focus-visible:shadow-focus max-[799px]:h-11 ${
      wlaczona
        ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.05)]"
        : "bg-transparent text-muted-foreground hover:text-foreground"
    }`;
  // Komórka siatki: 32 px, promień 8 px; zaznaczona — ramka rgba(0,0,0,.18) i tło rgba(0,0,0,.05)
  const klasaKomorki = (zaznaczona: boolean) =>
    `flex h-8 cursor-pointer items-center justify-center rounded-[8px] p-0 text-lg leading-none outline-none focus-visible:shadow-focus max-[799px]:h-11 ${
      zaznaczona ? "border border-black/[.18] bg-black/5" : "border border-transparent bg-transparent hover:bg-black/[.04]"
    }`;

  // role="group": dymek wokół (ActionPopover / arkusz) już jest oknem
  return (
    <div role="group" aria-label="Wybór ikony" className="box-border flex w-full flex-col gap-2 text-sm text-foreground">
      <div className="flex items-center gap-2">
        {/* .seg z coss.css; przyciski z aria-pressed jak dotąd */}
        <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          <button
            type="button"
            aria-pressed={zakladka === "emoji"}
            onClick={() => setZakladka("emoji")}
            className={klasaZakladki(zakladka === "emoji")}
          >
            Emoji
          </button>
          <button
            type="button"
            aria-pressed={zakladka === "icons"}
            onClick={() => setZakladka("icons")}
            className={klasaZakladki(zakladka === "icons")}
          >
            Ikony
          </button>
        </div>
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

      {zakladka === "icons" && (
        <div role="group" aria-label="Kolor ikony" className="flex flex-wrap items-center gap-2 px-0.5 pt-0.5 max-[799px]:gap-0">
          {ICON_COLORS.map((k) => {
            const wybrany = k.key === kolor;
            return (
              <button
                key={k.key}
                type="button"
                aria-label={k.label}
                aria-pressed={wybrany}
                onClick={() => setKolor(k.key)}
                className="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 max-[799px]:size-11"
              >
                {/* Kropka koloru 18 px; wybrana ma białą obwódkę i pierścień w swoim kolorze */}
                <span
                  className="block size-[18px] rounded-full transition-transform duration-[120ms] hover:scale-[1.12]"
                  style={{
                    background: k.hex,
                    border: `2px solid ${wybrany ? "#ffffff" : "transparent"}`,
                    boxShadow: wybrany ? `0 0 0 2px ${k.hex}` : "inset 0 0 0 1px rgba(0,0,0,.08)",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      <div className="-mx-0.5 max-h-[236px] overflow-y-auto px-0.5">
        {zakladka === "emoji" ? (
          <div className="grid grid-cols-8 gap-0.5">
            {emoji.map(([znak, slowa]) => (
              <button
                key={znak}
                type="button"
                aria-label={`Emoji ${slowa.split(" ").slice(0, 2).join(" ")}`}
                aria-pressed={obecna?.kind === "emoji" && obecna.v === znak}
                onClick={() => onPick(serializePageIcon({ kind: "emoji", v: znak }))}
                className={klasaKomorki(obecna?.kind === "emoji" && obecna.v === znak)}
                style={{ fontFamily: EMOJI_FONT }}
              >
                {znak}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {ikony.map(([nazwa, slowa]) => {
              const zaznaczona = obecna?.kind === "icon" && obecna.v === nazwa && obecna.color === kolor;
              const zapis = serializePageIcon({ kind: "icon", v: nazwa, color: kolor });
              return (
                <button
                  key={nazwa}
                  type="button"
                  aria-label={`Ikona ${slowa.split(" ").slice(0, 2).join(" ")}`}
                  aria-pressed={zaznaczona}
                  onClick={() => onPick(zapis)}
                  className={klasaKomorki(zaznaczona)}
                >
                  <PageIcon icon={zapis} size={18} />
                </button>
              );
            })}
          </div>
        )}
        {pusto && (
          // .empty z CIconPicker: tytuł 14 px / 500 i podpowiedź .hint 12 px muted
          <div className="flex flex-col items-center gap-2 px-2 py-4 text-center">
            <span className="text-sm font-medium">Brak wyników</span>
            <span className="text-xs font-normal text-muted-foreground">Spróbuj innego słowa.</span>
          </div>
        )}
      </div>
    </div>
  );
}
