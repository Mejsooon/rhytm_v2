"use client";

import { filterSlash, type SlashItem } from "../blocks";

// Menu „Bloki” (EmptyPage.dc.html): lista pozycji z filtra, stopka ze skrótami
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
      className="absolute top-[calc(100%+6px)] left-8 z-30 w-[320px] rounded-md border border-input bg-white p-2 text-left text-[13px] text-foreground shadow-[0_12px_32px_rgba(0,0,0,.12),0_2px_6px_rgba(0,0,0,.06)]"
    >
      <div className="px-2 pt-1 pb-1.5 font-mono text-[11px] tracking-[.06em] text-muted-foreground uppercase">
        Bloki
      </div>
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
          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 px-2 py-1.5 text-left font-[inherit] text-[13px] text-foreground max-[799px]:min-h-11 ${
            i === active ? "bg-muted" : "bg-transparent"
          }`}
        >
          <span
            aria-hidden="true"
            className="inline-flex size-8 flex-none items-center justify-center rounded-md border border-border bg-white font-mono text-sm text-soft-foreground"
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
      <div className="mt-1 border-t border-border px-2 pt-1.5 pb-0.5 font-mono text-[11px] text-muted-foreground">
        ↑↓ wybór · Enter wstaw · Esc zamknij
      </div>
    </div>
  );
}
