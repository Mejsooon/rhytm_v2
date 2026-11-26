"use client";

import * as React from "react";
import { Ellipsis, Plus } from "lucide-react";

import { ActionPopover, Button, FIELD, MENU_ITEM, MENU_ITEM_DANGER, MENU_SEPARATOR } from "@/components/controls";
import { cn } from "@/lib/utils";

// Zakładka widoku (.vtab z S2Table): 36 px, kreska 2 px pod aktywną, liczba wierszy szara 12 px
const ZAKLADKA =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 border-0 border-b-2 border-transparent bg-transparent px-0.5 font-[inherit] text-sm font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:shadow-focus aria-pressed:border-b-foreground aria-pressed:text-foreground";

// Zakładki widoków tabeli (S2Table, „Zapisane widoki”): „Wszystkie” (id null) i zapisane widoki z liczbą wierszy,
// „+ Widok” na końcu. Aktywny zapisany widok ma „⋯” z menu: Zmień nazwę, Duplikuj widok, Usuń widok.
// Nazwę zmienia się też podwójnym kliknięciem zakładki (pole „Nazwa widoku”: Enter i wyjście zapisują, Esc anuluje).
export function ViewTabs({
  tabs,
  activeId,
  readOnly = false,
  onSelect,
  onAdd,
  onRename,
  onDuplicate,
  onDelete,
}: {
  tabs: { id: string | null; name: string; count: number }[];
  activeId: string | null;
  // Tabela tylko do odczytu (np. zamknięty sejf): zakładki przełączają, ale nie da się ich zmieniać
  readOnly?: boolean;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // Otwarte menu widoku i zmieniana nazwa (id widoku i szkic)
  const [menu, setMenu] = React.useState<string | null>(null);
  const [zmiana, setZmiana] = React.useState<{ id: string; nazwa: string } | null>(null);
  // Menu „Zmień nazwę” nie oddaje fokusu przyciskowi „⋯”, bo fokus idzie do pola nazwy
  const bezZwrotuFokusu = React.useRef(false);
  // Esc anulował zmianę nazwy: blur, który przychodzi przy chowaniu pola, nie zapisuje
  const anulowano = React.useRef(false);

  function zatwierdz() {
    if (anulowano.current) {
      anulowano.current = false;
      return;
    }
    if (!zmiana) return;
    setZmiana(null);
    if (zmiana.nazwa.trim() !== "") onRename(zmiana.id, zmiana.nazwa);
  }

  return (
    <div role="group" aria-label="Zapisane widoki" className="flex flex-wrap items-center">
      {tabs.map((t) => {
        const aktywna = t.id === activeId;
        const id = t.id;
        // „⋯” przy aktywnym zapisanym widoku albo przy widoku z otwartym menu
        const kropki = id !== null && !readOnly && (aktywna || menu === id) && zmiana?.id !== id;
        if (id !== null && zmiana?.id === id) {
          return (
            <input
              key={id}
              type="text"
              autoFocus
              aria-label="Nazwa widoku"
              value={zmiana.nazwa}
              maxLength={40}
              onChange={(e) => setZmiana({ id, nazwa: e.target.value })}
              onBlur={zatwierdz}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  zatwierdz();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  anulowano.current = true;
                  setZmiana(null);
                }
              }}
              className={cn(FIELD, "my-[3px] mr-[18px] h-[30px] w-[150px]")}
            />
          );
        }
        return (
          <span key={id ?? "wszystkie"} className="relative inline-flex items-center">
            <button
              type="button"
              aria-pressed={aktywna}
              onClick={() => onSelect(id)}
              onDoubleClick={() => {
                if (id === null || readOnly) return;
                anulowano.current = false;
                setZmiana({ id, nazwa: t.name });
              }}
              className={cn(ZAKLADKA, kropki ? "mr-0" : "mr-[18px]")}
            >
              {t.name} <span className="text-xs text-[#a3a3a3] tabular-nums">{t.count}</span>
            </button>
            {kropki && (
              <ActionPopover
                open={menu === id}
                onOpenChange={(o) => setMenu(o ? id : null)}
                align="start"
                width={200}
                className="p-1"
                onCloseAutoFocus={(e) => {
                  if (bezZwrotuFokusu.current) {
                    e.preventDefault();
                    bezZwrotuFokusu.current = false;
                  }
                }}
                trigger={
                  <Button
                    variant="ghost"
                    size="xs"
                    icon
                    aria-label={`Menu widoku ${t.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menu === id}
                    className="mr-3.5 -ml-0.5 text-muted-foreground"
                  >
                    <Ellipsis aria-hidden="true" className="size-3.5" />
                  </Button>
                }
              >
                <div role="menu" aria-label={`Menu widoku ${t.name}`}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      bezZwrotuFokusu.current = true;
                      setMenu(null);
                      anulowano.current = false;
                      setZmiana({ id, nazwa: t.name });
                    }}
                    className={MENU_ITEM}
                  >
                    Zmień nazwę
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      onDuplicate(id);
                    }}
                    className={MENU_ITEM}
                  >
                    Duplikuj widok
                  </button>
                  <div className={MENU_SEPARATOR} />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      onDelete(id);
                    }}
                    className={cn(MENU_ITEM, MENU_ITEM_DANGER)}
                  >
                    Usuń widok
                  </button>
                </div>
              </ActionPopover>
            )}
          </span>
        );
      })}
      {!readOnly && (
        <button
          type="button"
          onClick={onAdd}
          title="Zapisz obecne filtry jako nowy widok"
          className={cn(ZAKLADKA, "mr-[18px] text-[#a3a3a3]")}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Widok
        </button>
      )}
    </div>
  );
}
