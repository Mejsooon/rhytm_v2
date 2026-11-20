"use client";

import * as React from "react";

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

// Wybór ikony strony jak w Notion (IconPicker.dc.html): zakładki „Emoji” / „Ikony”, „Usuń”,
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

  const klasaZakladki = (wlaczona: boolean) =>
    `-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-2 pt-1.5 pb-2 font-[inherit] text-[13px] max-[799px]:min-h-11 ${
      wlaczona ? "border-[#171717] font-medium text-[#171717]" : "border-transparent text-[#666666]"
    }`;
  const klasaKomorki = (zaznaczona: boolean) =>
    `flex h-8 cursor-pointer items-center justify-center rounded-md p-0 text-lg leading-none hover:bg-[#f0f0f0] max-[799px]:h-11 ${
      zaznaczona ? "border border-[#171717] bg-[#f5f5f5]" : "border border-transparent bg-transparent"
    }`;

  // role="group": dymek wokół (ActionPopover / arkusz) już jest oknem
  return (
    <div role="group" aria-label="Wybór ikony" className="box-border flex w-full flex-col gap-2 text-[13px] text-[#171717]">
      <div className="flex items-center gap-0.5 border-b border-[#eaeaea]">
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
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onPick("")}
          className="cursor-pointer border-0 bg-transparent px-1.5 pt-1.5 pb-2 font-[inherit] text-xs text-[#666666] hover:text-[#171717] max-[799px]:min-h-11"
        >
          Usuń
        </button>
      </div>

      <input
        type="text"
        value={fraza}
        onChange={(e) => setFraza(e.target.value)}
        placeholder="Szukaj ikony…"
        aria-label="Szukaj ikony"
        className="box-border w-full rounded-md border border-[#e0e0e0] bg-white px-[9px] py-[7px] font-[inherit] text-[13px] text-[#171717] outline-none focus:border-[#171717] max-[799px]:min-h-11"
      />

      {zakladka === "icons" && (
        <div role="group" aria-label="Kolor ikony" className="flex flex-wrap items-center gap-1.5 max-[799px]:gap-0">
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
                    boxShadow: wybrany ? `0 0 0 2px ${k.hex}` : "none",
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
        {pusto && <p className="my-2.5 text-center text-xs text-[#6b6b6b]">Brak wyników</p>}
      </div>
    </div>
  );
}
