"use client";

import * as React from "react";
import { ArrowUpDown, Check, Eye, Kanban, Search, Table, TextAlignStart } from "lucide-react";

import { ActionPopover, MENU_ITEM, MENU_LABEL, MENU_SEPARATOR } from "@/components/controls";
import { cn } from "@/lib/utils";
import type { PageField } from "../fields";
import type { SortKey, TableView } from "../table-model";
import type { EffectiveView } from "../table-views";

// Przycisk paska (.tb z S2Table): 30 px, szary 13 px; „on” (aktywne grupowanie, filtr, ukryte pola) z tłem 5 %
export const PRZYCISK_PASKA =
  "inline-flex h-[30px] flex-none cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 font-[inherit] text-[13px] font-medium whitespace-nowrap text-muted-foreground outline-none hover:bg-black/[.04] hover:text-foreground focus-visible:shadow-focus aria-expanded:bg-black/[.04] aria-expanded:text-foreground";
export const PRZYCISK_PASKA_ON = "bg-black/[.05] text-foreground";
// Plakietka liczby przy przycisku (.bdg.sec)
export const PLAKIETKA =
  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-muted px-[5px] text-xs leading-none font-medium text-foreground tabular-nums";

// Segment (.seg): szare tło, wybrany przycisk to biała pigułka
const SEGMENT = "inline-flex gap-0.5 rounded-[10px] bg-black/[.05] p-[3px]";
const SEGMENT_PRZYCISK =
  "inline-flex h-[26px] cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border-0 bg-transparent px-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground outline-none focus-visible:shadow-focus aria-pressed:bg-white aria-pressed:text-foreground aria-pressed:shadow-[0_1px_2px_rgba(0,0,0,.08)]";

// Pozycja menu wyboru (.opt z ✓ po prawej)
const POZYCJA_WYBORU = cn(MENU_ITEM, "justify-between");

// Pasek narzędzi tabeli (S2Table): Tabela / Tablica, „Grupuj”, filtr (gniazdo `filter`), sortowanie, „Pola”,
// szukajka i menu „⋯” (gniazdo `menu`). Zmiany idą do bieżącego widoku przez wywołania zwrotne;
// fraza szukania jest stanem klienta (nie zapisuje się). Na telefonie zostają filtr, „Pola”, szukajka i „⋯”.
export function TableToolbar({
  fields,
  view,
  query,
  onQuery,
  onLayout,
  onGroupBy,
  onSort,
  onHiddenChange,
  filter,
  menu,
  showSearch = true,
}: {
  fields: PageField[];
  view: EffectiveView;
  query: string;
  onQuery: (q: string) => void;
  onLayout: (layout: TableView["layout"]) => void;
  onGroupBy: (fieldId: string | null) => void;
  onSort: (sort: SortKey[]) => void;
  onHiddenChange: (ids: string[]) => void;
  filter: React.ReactNode;
  menu: React.ReactNode;
  // Moduł Hasła ma własną wyszukiwarkę nad tabelą
  showSearch?: boolean;
}) {
  const [otwarte, setOtwarte] = React.useState<"grupuj" | "sortuj" | "pola" | null>(null);

  // Grupować można po polach wyboru, statusu i checkboxach (jak groupRows)
  const doGrupowania = fields.filter((f) => f.type === "select" || f.type === "status" || f.type === "checkbox");
  const poleGrupy = fields.find((f) => f.id === view.group_by && doGrupowania.includes(f));

  // Klucz sortu na przycisku: pierwszy poza polem grupowania (grupy i tak idą w kolejności opcji)
  const kluczSortu =
    view.sort.find((k) => k.field_id !== view.group_by && fields.some((f) => f.id === k.field_id)) ??
    view.sort.find((k) => fields.some((f) => f.id === k.field_id));
  const poleSortu = kluczSortu ? fields.find((f) => f.id === kluczSortu.field_id) : undefined;
  const kierunek = kluczSortu?.dir ?? "asc";
  // Sekretów (szyfrogramów) się nie sortuje
  const doSortu = fields.filter((f) => f.type !== "secret");

  const ukryte = view.hidden_field_ids.filter((id) => fields.some((f) => f.id === id));
  const widoczne = fields.filter((f) => !ukryte.includes(f.id));

  return (
    <div className="relative flex flex-wrap items-center gap-1 pb-1.5">
      <div role="group" aria-label="Typ widoku" className={cn(SEGMENT, "max-[799px]:hidden")}>
        <button
          type="button"
          aria-pressed={view.layout === "table"}
          onClick={() => onLayout("table")}
          className={SEGMENT_PRZYCISK}
        >
          <Table aria-hidden="true" className="size-3.5" />
          Tabela
        </button>
        <button
          type="button"
          aria-pressed={view.layout === "board"}
          onClick={() => onLayout("board")}
          className={SEGMENT_PRZYCISK}
        >
          <Kanban aria-hidden="true" className="size-3.5" />
          Tablica
        </button>
      </div>

      <div className="max-[799px]:hidden">
        <ActionPopover
          open={otwarte === "grupuj"}
          onOpenChange={(o) => setOtwarte(o ? "grupuj" : null)}
          align="end"
          className="min-w-[220px] p-1"
          trigger={
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={otwarte === "grupuj"}
              className={cn(PRZYCISK_PASKA, poleGrupy && PRZYCISK_PASKA_ON)}
            >
              <TextAlignStart aria-hidden="true" className="size-3.5" />
              {poleGrupy ? `Grupuj: ${poleGrupy.name}` : "Grupuj"}
            </button>
          }
        >
          <div role="menu" aria-label="Grupuj według">
            <div className={MENU_LABEL}>Grupuj według</div>
            {[{ id: null as string | null, name: "Bez grupowania" }, ...doGrupowania].map((o) => {
              const wybrane = (poleGrupy?.id ?? null) === o.id;
              return (
                <button
                  key={o.id ?? "brak"}
                  type="button"
                  role="menuitemradio"
                  aria-checked={wybrane}
                  onClick={() => {
                    setOtwarte(null);
                    onGroupBy(o.id);
                  }}
                  className={POZYCJA_WYBORU}
                >
                  <span className="flex-1">{o.name}</span>
                  {wybrane && <Check aria-hidden="true" className="size-3.5 flex-none" />}
                </button>
              );
            })}
          </div>
        </ActionPopover>
      </div>

      {filter}

      <div className="max-[799px]:hidden">
        <ActionPopover
          open={otwarte === "sortuj"}
          onOpenChange={(o) => setOtwarte(o ? "sortuj" : null)}
          align="end"
          className="min-w-[220px] p-1"
          trigger={
            <button type="button" aria-haspopup="menu" aria-expanded={otwarte === "sortuj"} className={PRZYCISK_PASKA}>
              <ArrowUpDown aria-hidden="true" className="size-3.5" />
              {poleSortu ? `${poleSortu.name} ${kierunek === "asc" ? "↑" : "↓"}` : "Sortuj"}
            </button>
          }
        >
          <div role="menu" aria-label="Sortuj">
            <div className={MENU_LABEL}>Sortuj według</div>
            {doSortu.map((f) => {
              const wybrane = poleSortu?.id === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={wybrane}
                  // Wybór pola zastępuje sortowanie jednym kluczem z bieżącym kierunkiem
                  onClick={() => onSort([{ field_id: f.id, dir: kierunek }])}
                  className={POZYCJA_WYBORU}
                >
                  <span className="flex-1">{f.name}</span>
                  {wybrane && <Check aria-hidden="true" className="size-3.5 flex-none" />}
                </button>
              );
            })}
            <div className={MENU_SEPARATOR} />
            <div className="p-1">
              <div role="group" aria-label="Kierunek" className={cn(SEGMENT, "box-border flex w-full")}>
                {(["asc", "desc"] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    aria-pressed={kierunek === dir}
                    disabled={!kluczSortu}
                    // Kierunek zmienia klucz pokazany na przycisku; pozostałe klucze zostają
                    onClick={() =>
                      onSort(view.sort.map((k) => (k === kluczSortu ? { field_id: k.field_id, dir } : k)))
                    }
                    className={cn(SEGMENT_PRZYCISK, "flex-1 disabled:cursor-not-allowed disabled:opacity-[.64]")}
                  >
                    {dir === "asc" ? "Rosnąco" : "Malejąco"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ActionPopover>
      </div>

      <ActionPopover
        open={otwarte === "pola"}
        onOpenChange={(o) => setOtwarte(o ? "pola" : null)}
        align="end"
        ariaLabel="Widoczne pola"
        className="min-w-[220px] p-1"
        trigger={
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={otwarte === "pola"}
            className={cn(PRZYCISK_PASKA, ukryte.length > 0 && PRZYCISK_PASKA_ON)}
          >
            <Eye aria-hidden="true" className="size-3.5" />
            Pola
            {ukryte.length > 0 && <span className={PLAKIETKA}>{ukryte.length} ukryte</span>}
          </button>
        }
      >
        <div className={MENU_LABEL}>Widoczne pola</div>
        {fields.map((f) => {
          const jestWidoczne = !ukryte.includes(f.id);
          // Tytułu i ostatniego widocznego pola nie da się ukryć; ukryte pole zawsze da się przywrócić
          const zablokowane = jestWidoczne && (f.isTitle || widoczne.length === 1);
          return (
            <label key={f.id} className={cn(MENU_ITEM, zablokowane && "cursor-not-allowed")}>
              <input
                type="checkbox"
                checked={jestWidoczne}
                disabled={zablokowane}
                onChange={() =>
                  onHiddenChange(jestWidoczne ? [...ukryte, f.id] : ukryte.filter((id) => id !== f.id))
                }
                className="m-0 size-[15px] accent-foreground"
              />
              <span>{f.name}</span>
            </label>
          );
        })}
      </ActionPopover>

      {showSearch && (
        <label className="relative inline-flex items-center">
          <span className="sr-only">Szukaj</span>
          <Search aria-hidden="true" className="absolute left-2.5 size-3.5 text-[#a3a3a3]" />
          <input
            type="search"
            placeholder="Szukaj…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            className="h-[30px] w-[170px] min-w-0 rounded-md border border-input bg-white bg-clip-padding pr-2 pl-[30px] text-[13px] text-foreground shadow-xs outline-none placeholder:text-faint-foreground focus:border-ring focus:shadow-halo max-[799px]:h-11 max-[799px]:w-[200px] max-[799px]:text-base"
          />
        </label>
      )}

      {menu}
    </div>
  );
}
