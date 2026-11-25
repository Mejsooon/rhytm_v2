"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Table2, SquareCheck } from "lucide-react";

import { Button, StatusBadge } from "@/components/controls";
import { PageMenu } from "../../page-menu";
import type { PageSummary } from "../../load-pages";
import { rowsForm, rowsLabel } from "../../rows-label";
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

// Przycisk „Więcej” w nagłówku: kwadrat 44 px jak .btng.ic z makiety
const PRZYCISK_WIECEJ =
  "inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent p-0 font-[inherit] text-foreground hover:bg-accent";

// Telefon (CMEditor.dc.html): nagłówek .m-head z powrotem do „Stron” i menu „Więcej”, treść strony
// (`children`: tytuł 24/600 i bloki), pole poleceń z podpowiedzią, pasek skrótów (.editbar) nad paskiem
// zakładek i arkusz „Wstaw blok”. Widoczne tylko poniżej 800 px (klasy). Bloki i tytuł rysuje wspólne
// drzewo w `children`, stan bloków jest jeden.
export function MEditor({
  store,
  page,
  pages,
  pagesStore,
  onRename,
  ownScreen = false,
  children,
}: {
  store: EditorStore;
  page: PageSummary;
  pages: PageSummary[];
  pagesStore: PagesStore;
  onRename: () => void;
  // Strona ma na telefonie własny ekran (Subscriptions, CMSubs): bez nagłówka, pola poleceń i paska skrótów edytora
  ownScreen?: boolean;
  children: React.ReactNode;
}) {
  const [menuOtwarte, setMenuOtwarte] = React.useState(false);
  const [komenda, setKomenda] = React.useState("");

  // Dopisek w arkuszu menu strony: wiersze i pola wszystkich tabel strony; bez tabel „pusta strona”
  const tabele = store.blocks.filter((b) => b.type === "table");
  const wiersze = tabele.reduce((suma, b) => suma + b.rows.filter((r) => r.deletedAt === null).length, 0);
  const pola = tabele.reduce((suma, b) => suma + b.fields.length, 0);
  const formaPol = rowsForm(pola);
  const dopisek =
    tabele.length === 0
      ? "pusta strona"
      : `${rowsLabel(wiersze)} · ${pola} ${formaPol === "one" ? "pole" : formaPol === "few" ? "pola" : "pól"}`;

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

  if (ownScreen) return <>{children}</>;

  return (
    <>
      <header className="m-head flex-none px-2 min-[800px]:hidden">
        <Button variant="ghost" icon asChild>
          <Link href="/strony" aria-label="Strony">
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        </Button>
        <div className="flex-1" />
        <PageMenu
          page={page}
          pages={pages}
          store={pagesStore}
          onRename={onRename}
          sheet
          triggerLabel="Więcej"
          meta={dopisek}
          triggerClassName={PRZYCISK_WIECEJ}
        />
      </header>

      {children}

      {/* ed-body: odstęp 10 px, dół zostawia miejsce na pasek skrótów i pasek zakładek */}
      <div className="flex flex-col gap-2.5 px-4 pb-[calc(var(--tabbar-h)+72px)] min-[800px]:hidden">
        {store.blocks.length === 0 && (
          <p className="m-0 mb-1.5 text-xs text-muted-foreground">
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
          className="box-border w-full min-w-0 rounded-md border-0 bg-transparent py-2.5 font-[inherit] text-base text-soft-foreground outline-none placeholder:text-faint-foreground focus:bg-black/[.02] focus:shadow-[0_0_0_2px_rgba(38,38,38,.08)]"
        />
      </div>

      {/* .editbar: pasek skrótów siedzi nad paskiem zakładek (--tabbar-h), który sam obsługuje safe-area */}
      <div className="fixed inset-x-0 bottom-(--tabbar-h) z-30 flex items-center gap-1 border-t border-border bg-[#fafafa] px-3 py-2 min-[800px]:hidden">
        <Button variant="primary" icon aria-label="Wstaw blok" onClick={() => setMenuOtwarte(true)}>
          <Plus size={20} aria-hidden="true" />
        </Button>
        <Button variant="ghost" icon aria-label="Wstaw tabelę" onClick={() => wstaw("table")}>
          <Table2 size={20} aria-hidden="true" />
        </Button>
        <Button variant="ghost" icon aria-label="Wstaw zadanie" onClick={() => wstaw("todo")}>
          <SquareCheck size={20} aria-hidden="true" />
        </Button>
        <Button variant="ghost" icon aria-label="Wstaw nagłówek" onClick={() => wstaw("heading")} className="font-bold">
          H
        </Button>
        <span className="flex-1" />
        <StatusBadge tone="gray">{blokiLabel(store.blocks.length)}</StatusBadge>
      </div>

      <MInsertSheet
        open={arkuszOtwarty}
        query={zapytanie}
        onPick={(p) => wstaw(p.type)}
        onClose={zamknijArkusz}
        focusSheet={menuOtwarte}
      />
    </>
  );
}
