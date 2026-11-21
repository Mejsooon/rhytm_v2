"use client";

import { Kbd, MENU_ITEM, MENU_LABEL, MENU_SEPARATOR } from "@/components/controls";
import { cn } from "@/lib/utils";
import { filterSlash, type SlashItem } from "../blocks";

// Menu „Bloki” (CEmptyPage.dc.html, .pop z pozycjami .mi): lista pozycji z filtra, stopka ze skrótami
export function SlashMenu({
  query,
  active,
  onActive,
  onPick,
}: {
  query: string;
  active: number;
  onActive: (index: number) => void;
  onPick: (item: SlashItem) => void;
}) {
  const pozycje = filterSlash(query);

  return (
    <div
      role="listbox"
      id="menu-blokow"
      aria-label="Bloki"
      // .pop epop: promień 12 px, ramka border, cień lg, padding 4 px; 330 px, 40 px od lewej
      className="absolute top-[calc(100%+6px)] left-10 z-30 w-[330px] rounded-xl border border-border bg-white bg-clip-padding p-1 text-left text-sm font-normal text-foreground shadow-lg"
    >
      <div className={MENU_LABEL}>Bloki</div>
      {pozycje.map((p, i) => (
        <button
          key={p.type}
          type="button"
          role="option"
          aria-selected={i === active}
          // Wybór myszą nie może zabrać fokusu polu poleceń przed kliknięciem
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onActive(i)}
          onClick={() => onPick(p)}
          // .mi: aktywna pozycja (aria-selected) ma tło accent; min. 44 px
          className={cn(MENU_ITEM, "min-h-11 gap-2.5 aria-selected:bg-accent")}
        >
          {/* .ico: 32 px, ramka border, promień 8 px, cień xs */}
          <span
            aria-hidden="true"
            className="inline-flex size-8 flex-none items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold text-soft-foreground shadow-xs"
          >
            {p.icon}
          </span>
          <span className="flex min-w-0 flex-col gap-px">
            <span className="font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.desc}</span>
          </span>
        </button>
      ))}
      {pozycje.length === 0 && (
        <div className="p-2 text-[13px] text-muted-foreground">Brak bloku „{query.trim()}”</div>
      )}
      <div className={MENU_SEPARATOR} />
      <div className="flex gap-2.5 px-2 pt-1 pb-0.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> wybór
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Enter</Kbd> wstaw
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Esc</Kbd> zamknij
        </span>
      </div>
    </div>
  );
}
