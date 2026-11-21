"use client";

import * as React from "react";

import { Plus } from "lucide-react";

import { Button } from "@/components/controls";
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
      {/* .btn.ic.sm: 28 px, ramka input, cień; na telefonie 44 px jak dotąd */}
      <Button
        icon
        size="sm"
        aria-label="Wstaw blok"
        onClick={() => {
          setWartosc("/");
          setAktywna(0);
          setZamkniete(false);
          poleRef.current?.focus();
        }}
        className="max-[799px]:size-11"
      >
        <Plus size={16} aria-hidden="true" />
      </Button>
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
        className="min-w-0 flex-1 rounded-md border-0 bg-transparent py-1.5 font-[inherit] text-foreground outline-none placeholder:text-faint-foreground focus:bg-black/[.02] focus:shadow-[0_0_0_2px_rgba(38,38,38,.08)]"
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
