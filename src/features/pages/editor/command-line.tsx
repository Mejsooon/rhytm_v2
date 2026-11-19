"use client";

import * as React from "react";

import { filterSlash, type SlashItem } from "../blocks";
import { SlashMenu } from "./slash-menu";

// Linia poleceń na końcu strony: „/” otwiera menu bloków, zwykły tekst + Enter dopisuje akapit
export function CommandLine({
  onInsert,
}: {
  onInsert: (type: SlashItem["type"], text?: string) => void;
}) {
  const [wartosc, setWartosc] = React.useState("");
  const [aktywna, setAktywna] = React.useState(0);
  // Menu zamknięte klawiszem Esc zostaje zamknięte do następnej zmiany tekstu
  const [zamkniete, setZamkniete] = React.useState(false);
  const poleRef = React.useRef<HTMLInputElement>(null);

  const jestPolecenie = wartosc.startsWith("/");
  const zapytanie = jestPolecenie ? wartosc.slice(1) : "";
  const pozycje = jestPolecenie ? filterSlash(zapytanie) : [];
  const menuOtwarte = jestPolecenie && !zamkniete;
  const biezaca = Math.max(0, Math.min(aktywna, pozycje.length - 1));

  function wstaw(typ: SlashItem["type"], tekst?: string) {
    onInsert(typ, tekst);
    setWartosc("");
    setAktywna(0);
    setZamkniete(false);
  }

  function przyKlawiszu(e: React.KeyboardEvent<HTMLInputElement>) {
    if (menuOtwarte) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (pozycje.length > 0) setAktywna((biezaca + 1) % pozycje.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (pozycje.length > 0) setAktywna((biezaca - 1 + pozycje.length) % pozycje.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pozycje[biezaca]) wstaw(pozycje[biezaca].type);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setZamkniete(true);
      }
      return;
    }
    if (e.key === "Enter" && !jestPolecenie && wartosc.trim() !== "") {
      e.preventDefault();
      wstaw("text", wartosc.trim());
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        aria-label="Wstaw blok"
        onClick={() => {
          setWartosc("/");
          setAktywna(0);
          setZamkniete(false);
          poleRef.current?.focus();
        }}
        className="inline-flex size-6 flex-none cursor-pointer items-center justify-center rounded-md border border-[#e0e0e0] bg-white p-0 font-[inherit] text-[15px] leading-none text-[#6b6b6b] hover:bg-[#f5f5f5] hover:text-[#171717] max-[799px]:size-11"
      >
        +
      </button>
      <input
        ref={poleRef}
        type="text"
        value={wartosc}
        onChange={(e) => {
          setWartosc(e.target.value);
          setAktywna(0);
          setZamkniete(false);
        }}
        onKeyDown={przyKlawiszu}
        placeholder="Wpisz „/”, aby wstawić blok — tabelę, listę, nagłówek…"
        aria-label="Nowy blok"
        role="combobox"
        aria-controls={menuOtwarte ? "menu-blokow" : undefined}
        aria-haspopup="listbox"
        aria-expanded={menuOtwarte}
        className="min-w-0 flex-1 border-0 bg-transparent py-1.5 font-[inherit] text-[#404040] outline-none placeholder:text-[#a3a3a3]"
      />
      {menuOtwarte && (
        <SlashMenu
          query={zapytanie}
          active={biezaca}
          onActive={setAktywna}
          onPick={(p) => wstaw(p.type)}
        />
      )}
    </div>
  );
}
