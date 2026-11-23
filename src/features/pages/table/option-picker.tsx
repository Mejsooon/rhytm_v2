"use client";

import * as React from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { Button, StatusBadge } from "@/components/controls";
import { KOLORY_OPCJI, type PageField } from "../fields";
import { OptionBadge } from "./option-badge";

// Pozycja listy / koloru z makiety (.ddopt): wiersz 32 px, najechanie podświetla
const POZYCJA =
  "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-sm text-foreground outline-none hover:bg-accent focus-visible:bg-accent";
// Pole wyszukiwania i nazwy z makiety (.inp: 30 px, 13 px)
const POLE =
  "h-[30px] w-full rounded-md border border-input bg-white px-2.5 text-[13px] outline-none focus-visible:shadow-focus";

// Treść okienka opcji komórki Select i Status (S2Books.dc.html, funkcja tsel): lista z wyszukiwaniem
// i tworzeniem opcji oraz panel „Edycja opcji” (nazwa, kolor, usunięcie). Zapis opcji idzie przez
// onCreate / onUpdate / onRemove, wybór komórki przez onPick (null czyści).
export function OptionPicker({
  field,
  value,
  onPick,
  onCreate,
  onUpdate,
  onRemove,
}: {
  field: PageField;
  value: string | null;
  onPick: (id: string | null) => void;
  onCreate: (label: string) => Promise<string | null>;
  onUpdate: (id: string, patch: { label?: string; color?: string }) => void;
  onRemove: (id: string) => void;
}) {
  const opcje = field.config.options ?? [];
  // Wpisany tekst, opcja w panelu (null = lista) i szkic jej nazwy
  const [q, setQ] = React.useState("");
  const [edytowanaId, setEdytowanaId] = React.useState<string | null>(null);
  const [nazwa, setNazwa] = React.useState("");

  const szukane = q.trim();
  const pasujace = opcje.filter((o) => o.label.toLowerCase().includes(szukane.toLowerCase()));
  const dokladna = opcje.find((o) => o.label.toLowerCase() === szukane.toLowerCase());
  const edytowana = opcje.find((o) => o.id === edytowanaId);

  // Wybór bieżącej opcji ją czyści
  function wybierz(id: string) {
    onPick(id === value ? null : id);
  }

  // Tworzy opcję z wpisanego tekstu i od razu ją wybiera (null = serwer odmówił, okienko zostaje)
  async function utworz() {
    const id = await onCreate(szukane);
    if (id !== null) onPick(id);
  }

  // Panel: zapis nazwy (tylko gdy niepusta i zmieniona), potem powrót do listy
  function zapiszNazwe() {
    const nowa = nazwa.trim();
    if (edytowana && nowa !== "" && nowa !== edytowana.label) onUpdate(edytowana.id, { label: nowa });
    setEdytowanaId(null);
  }

  if (edytowana) {
    return (
      <div role="group" aria-label="Edycja opcji" className="flex flex-col gap-1">
        <input
          type="text"
          autoFocus
          aria-label="Nazwa opcji"
          value={nazwa}
          onChange={(e) => setNazwa(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              zapiszNazwe();
            }
          }}
          className={POLE}
        />
        <div className="px-1 pt-2 pb-0.5 text-xs font-medium text-muted-foreground">Kolor</div>
        {KOLORY_OPCJI.map((k) => (
          <button
            key={k.name}
            type="button"
            aria-label={k.name}
            aria-pressed={edytowana.color === k.color}
            onClick={() => onUpdate(edytowana.id, { color: k.color })}
            className={POZYCJA}
          >
            <OptionBadge option={{ ...edytowana, color: k.color, label: k.name }} />
            {edytowana.color === k.color && <Check aria-hidden="true" className="ml-auto size-4" />}
          </button>
        ))}
        <div className="mt-1 border-t border-border pt-1">
          <button
            type="button"
            onClick={() => {
              onRemove(edytowana.id);
              setEdytowanaId(null);
            }}
            className={`${POZYCJA} text-destructive-foreground`}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Usuń opcję
          </button>
        </div>
        <div className="flex justify-between gap-2 pt-0.5">
          <Button variant="ghost" size="sm" onClick={() => setEdytowanaId(null)}>
            Wstecz
          </Button>
          <Button size="sm" onClick={zapiszNazwe}>
            Gotowe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div role="listbox" aria-label={field.name} className="flex flex-col">
      <div className="px-1 pt-1 pb-1.5">
        <input
          type="text"
          autoFocus
          aria-label="Szukaj lub dodaj opcję"
          placeholder="Szukaj lub dodaj opcję…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || szukane === "") return;
            e.preventDefault();
            // Dokładne trafienie wybiera, brak trafienia tworzy
            if (dokladna) wybierz(dokladna.id);
            else void utworz();
          }}
          className={POLE}
        />
      </div>
      {pasujace.map((o) => (
        <div key={o.id} className="group/opcja flex items-center gap-0.5">
          <button
            type="button"
            role="option"
            aria-selected={o.id === value}
            onClick={() => wybierz(o.id)}
            className={`${POZYCJA} min-w-0 flex-1`}
          >
            {field.type === "status" ? <OptionBadge option={o} /> : <StatusBadge tone="outline">{o.label}</StatusBadge>}
            {o.id === value && <Check aria-hidden="true" className="ml-auto size-4" />}
          </button>
          {/* „⋯” widoczne po najechaniu i przy fokusie (.optmenu) */}
          <Button
            variant="ghost"
            size="xs"
            icon
            aria-label={`Opcje: ${o.label}`}
            onClick={() => {
              setNazwa(o.label);
              setEdytowanaId(o.id);
            }}
            className="opacity-0 group-hover/opcja:opacity-100 focus-visible:opacity-100"
          >
            <span aria-hidden="true">⋯</span>
          </Button>
        </div>
      ))}
      {szukane !== "" && !dokladna && (
        <button
          type="button"
          onClick={() => void utworz()}
          aria-label={`Utwórz «${szukane}»`}
          className={`${POZYCJA} mt-1 gap-2 border-t border-border`}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Utwórz
          <StatusBadge tone="gray">{`«${szukane}»`}</StatusBadge>
        </button>
      )}
    </div>
  );
}
