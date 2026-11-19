"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";

import { PageMenu } from "../../page-menu";
import type { PageSummary } from "../../load-pages";
import { rowsForm } from "../../rows-label";
import type { PagesStore } from "../../use-pages-store";
import { filterSlash } from "../../blocks";
import type { EditorStore } from "../use-editor-store";
import { MInsertSheet } from "./m-insert-sheet";

// Odmiana „N bloków” (1 blok, 2–4 bloki, 5+ bloków)
function blokiLabel(n: number): string {
  const forma = rowsForm(n);
  if (forma === "one") return `${n} blok`;
  if (forma === "few") return `${n} bloki`;
  return `${n} bloków`;
}

const PRZYCISK_PASKA =
  "inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent p-0 font-[inherit] text-[#171717] hover:bg-[#f5f5f5]";

// Telefon (MEditor.dc.html): nagłówek z powrotem i menu strony, treść strony (`children`), pole poleceń
// z podpowiedzią, dolny pasek skrótów nad paskiem zakładek i arkusz „Wstaw blok”. Widoczne tylko
// poniżej 800 px (klasy). Bloki i tytuł rysuje wspólne drzewo w `children`, stan bloków jest jeden.
export function MEditor({
  store,
  page,
  pages,
  pagesStore,
  onRename,
  children,
}: {
  store: EditorStore;
  page: PageSummary;
  pages: PageSummary[];
  pagesStore: PagesStore;
  onRename: () => void;
  children: React.ReactNode;
}) {
  const [menuOtwarte, setMenuOtwarte] = React.useState(false);
  const [komenda, setKomenda] = React.useState("");

  const jestPolecenie = komenda.startsWith("/");
  const zapytanie = jestPolecenie ? komenda.slice(1) : "";
  const arkuszOtwarty = menuOtwarte || jestPolecenie;

  function zamknijArkusz() {
    setMenuOtwarte(false);
    setKomenda("");
  }

  function wstaw(typ: Parameters<EditorStore["add"]>[0], tekst?: string) {
    void store.add(typ, tekst);
    zamknijArkusz();
  }

  function przyKlawiszu(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      zamknijArkusz();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (jestPolecenie) {
      const trafiony = filterSlash(zapytanie)[0];
      if (trafiony) wstaw(trafiony.type);
    } else if (komenda.trim() !== "") {
      wstaw("text", komenda.trim());
    }
  }

  return (
    <>
      <header className="flex min-h-[60px] flex-none items-center gap-1 p-2 min-[800px]:hidden">
        <Link href="/strony" aria-label="Strony" className={PRZYCISK_PASKA}>
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <div className="flex-1" />
        <PageMenu
          page={page}
          pages={pages}
          store={pagesStore}
          onRename={onRename}
          sheet
          triggerLabel="Menu strony"
          triggerClassName={PRZYCISK_PASKA}
        />
      </header>

      {children}

      <div className="flex flex-col gap-2.5 px-4 pb-[calc(var(--tabbar-h)+72px)] min-[800px]:hidden">
        {store.blocks.length === 0 && (
          <p className="m-0 mt-1 mb-1.5 text-[13px] text-[#666666]">
            Stuknij „+” na dole albo wpisz „/”, żeby wstawić blok.
          </p>
        )}
        <input
          type="text"
          value={komenda}
          onChange={(e) => setKomenda(e.target.value)}
          onKeyDown={przyKlawiszu}
          placeholder="Wpisz „/”, aby wstawić blok"
          aria-label="Nowy blok"
          className="min-h-11 w-full border-0 bg-transparent py-2 font-[inherit] text-[#404040] outline-none placeholder:text-[#a3a3a3]"
        />
      </div>

      {/* Pasek skrótów siedzi nad paskiem zakładek (--tabbar-h) */}
      <div className="fixed inset-x-0 bottom-(--tabbar-h) z-30 flex items-center gap-1 border-t border-[#eaeaea] bg-[#fafafa] px-3 py-2 min-[800px]:hidden">
        <button
          type="button"
          aria-label="Wstaw blok"
          onClick={() => setMenuOtwarte(true)}
          className={`${PRZYCISK_PASKA} !bg-[#171717] !text-white`}
        >
          <Plus size={22} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Wstaw tabelę" onClick={() => wstaw("table")} className={PRZYCISK_PASKA}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M9 10v10" />
          </svg>
        </button>
        <button type="button" aria-label="Wstaw zadanie" onClick={() => wstaw("todo")} className={PRZYCISK_PASKA}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="m8 12 3 3 5-6" />
          </svg>
        </button>
        <button type="button" aria-label="Wstaw nagłówek" onClick={() => wstaw("heading")} className={`${PRZYCISK_PASKA} font-bold`}>
          H
        </button>
        <span className="flex-1" />
        <span className="font-mono text-[11px] text-[#8a8a8a]">{blokiLabel(store.blocks.length)}</span>
      </div>

      <MInsertSheet
        open={arkuszOtwarty}
        query={zapytanie}
        onPick={(p) => wstaw(p.type)}
        onClose={zamknijArkusz}
      />
    </>
  );
}
