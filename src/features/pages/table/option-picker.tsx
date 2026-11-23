"use client";

import * as React from "react";
import { Check, Ellipsis, Plus, Trash2 } from "lucide-react";

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
  panelRef,
}: {
  field: PageField;
  value: string | null;
  onPick: (id: string | null) => void;
  onCreate: (label: string) => Promise<string | null>;
  onUpdate: (id: string, patch: { label?: string; color?: string }) => void;
  onRemove: (id: string) => void;
  // Wskaźnik „panel edycji jest otwarty”, dla Esc obsługiwanego przez okienko (Radix łapie Esc na document)
  panelRef?: React.MutableRefObject<{
    otwarty: boolean;
    wstecz: () => void;
  } | null>;
}) {
  const opcje = field.config.options ?? [];
  // Wpisany tekst, opcja w panelu (null = lista) i szkic jej nazwy
  const [q, setQ] = React.useState("");
  const [edytowanaId, setEdytowanaId] = React.useState<string | null>(null);
  const [nazwa, setNazwa] = React.useState("");
  // Opcja pod kursorem: jej „⋯” jest widoczne (warstwa „⋯” nie dziedziczy najechania z wiersza)
  const [najechana, setNajechana] = React.useState<string | null>(null);

  const szukane = q.trim();
  const pasujace = opcje.filter((o) =>
    o.label.toLowerCase().includes(szukane.toLowerCase()),
  );
  const dokladna = opcje.find(
    (o) => o.label.toLowerCase() === szukane.toLowerCase(),
  );
  const edytowana = opcje.find((o) => o.id === edytowanaId);
  // Okienko pyta o to przy Esc: w panelu Esc cofa do listy zamiast zamykać
  React.useEffect(() => {
    if (panelRef)
      panelRef.current = {
        otwarty: edytowana !== undefined,
        wstecz: () => setEdytowanaId(null),
      };
  });

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
    if (edytowana && nowa !== "" && nowa !== edytowana.label)
      onUpdate(edytowana.id, { label: nowa });
    setEdytowanaId(null);
  }

  if (edytowana) {
    return (
      <div
        role="group"
        aria-label="Edycja opcji"
        className="flex flex-col gap-1 p-1"
      >
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
        <div className="px-1 pt-2 pb-0.5 text-xs font-medium text-muted-foreground">
          Kolor
        </div>
        {KOLORY_OPCJI.map((k) => (
          <button
            key={k.name}
            type="button"
            aria-label={k.name}
            aria-pressed={edytowana.color === k.color}
            onClick={() => onUpdate(edytowana.id, { color: k.color })}
            className={POZYCJA}
          >
            <OptionBadge
              option={{ ...edytowana, color: k.color, label: k.name }}
            />
            {edytowana.color === k.color && (
              <Check aria-hidden="true" className="ml-auto size-4" />
            )}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEdytowanaId(null)}
          >
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
    <div role="group" aria-label={field.name} className="flex flex-col">
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
      <div className="relative">
        {/* Lista zawiera same opcje (role="option"); „⋯” leży obok, w osobnej warstwie nad końcem wierszy */}
        <div
          role="listbox"
          aria-label={`Opcje: ${field.name}`}
          className="flex flex-col"
        >
          {pasujace.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              onClick={() => wybierz(o.id)}
              onMouseEnter={() => setNajechana(o.id)}
              onMouseLeave={() => setNajechana(null)}
              onFocus={() => setNajechana(o.id)}
              onBlur={() => setNajechana(null)}
              className={`${POZYCJA} h-8 pr-9`}
            >
              <span className="flex min-w-0">
                <OptionBadge option={o} />
              </span>
              {o.id === value && (
                <Check aria-hidden="true" className="ml-auto size-4" />
              )}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-col">
          {pasujace.map((o) => (
            <div
              key={o.id}
              className="flex h-8 shrink-0 items-center justify-end"
            >
              {/* „⋯” widoczne po najechaniu i przy fokusie (.optmenu) */}
              <Button
                variant="ghost"
                size="xs"
                icon
                aria-label={`Edytuj opcję „${o.label}”`}
                onClick={() => {
                  setNazwa(o.label);
                  setEdytowanaId(o.id);
                }}
                className={`pointer-events-auto hover:opacity-100 focus-visible:opacity-100 ${najechana === o.id ? "opacity-100" : "opacity-0"}`}
              >
                <Ellipsis aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      {szukane !== "" && !dokladna && (
        <button
          type="button"
          onClick={() => void utworz()}
          aria-label={`Utwórz «${szukane}»`}
          className={`${POZYCJA} mt-1 gap-2 border-t border-border`}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Utwórz
          <StatusBadge tone="gray">{szukane}</StatusBadge>
        </button>
      )}
    </div>
  );
}
