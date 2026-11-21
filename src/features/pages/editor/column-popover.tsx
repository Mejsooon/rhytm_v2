"use client";

import * as React from "react";

import { Check, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import {
  ActionPopover,
  Button,
  FIELD,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_LABEL,
  MENU_SEPARATOR,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { EDITOR_TYPES, FIELD_TYPE_META, type FieldType, type PageField } from "../fields";
import { OptionBadge } from "./cell-editor";

// Dymek kolumny z EmptyPage.dc.html („Ustawienia kolumny”): nazwa, „Typ pola”, „Opcje” (Wybór),
// „← W lewo / W prawo →” i „Usuń kolumnę”. Przycisk nagłówka jest wyzwalaczem dymka w portalu.
export function ColumnPopover({
  field,
  index,
  count,
  open,
  onOpenChange,
  pending,
  onRename,
  onPickType,
  onAddOption,
  onRemoveOption,
  onMove,
  onDelete,
}: {
  field: PageField;
  index: number;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Kolumna czeka na odpowiedź serwera (tymczasowe id) — zmiany są wyłączone
  pending: boolean;
  onRename: (name: string) => void;
  onPickType: (type: FieldType) => void;
  onAddOption: (label: string) => void;
  onRemoveOption: (optionId: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [nazwa, setNazwa] = React.useState(field.name);
  const [zrodloNazwy, setZrodloNazwy] = React.useState(field.name);
  if (zrodloNazwy !== field.name) {
    setZrodloNazwy(field.name);
    setNazwa(field.name);
  }
  const [nowaOpcja, setNowaOpcja] = React.useState("");

  const jestWyborem = field.type === "status" || field.type === "select";
  const opcje = field.config.options ?? [];
  const meta = FIELD_TYPE_META[field.type];
  // Ikona nagłówka: ta sama co na liście typów w dymku (Wybór = status, Checkbox)
  const Ikona = EDITOR_TYPES.find((t) => t.type === field.type)?.Icon ?? meta.Icon;
  const nieMoznaUsunac = field.isTitle || count <= 1 || pending;

  function zapiszNazwe() {
    const czysta = nazwa.trim();
    if (czysta === "" || czysta === field.name) {
      setNazwa(field.name);
      return;
    }
    onRename(czysta);
  }

  function dodajOpcje() {
    const etykieta = nowaOpcja.trim();
    if (etykieta === "") return;
    onAddOption(etykieta);
    setNowaOpcja("");
  }

  return (
    <ActionPopover
      open={open}
      onOpenChange={onOpenChange}
      width={268}
      className="p-1"
      ariaLabel="Ustawienia kolumny"
      trigger={
        // .colbtn: ikona typu 12 px jasnoszara, tło 5% przy hover i otwarciu
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "-mx-1.5 -my-[3px] inline-flex cursor-pointer items-center gap-1.5 rounded-sm border-0 px-1.5 py-[3px] font-[inherit] font-medium whitespace-nowrap outline-none hover:bg-black/5 hover:text-foreground focus-visible:shadow-focus max-[799px]:hidden",
            open ? "bg-black/5 text-foreground" : "bg-transparent text-muted-foreground",
          )}
        >
          <Ikona size={14} aria-hidden="true" className="flex-none text-faint-foreground" />
          {field.name}
        </button>
      }
    >
      <div className="p-1">
        <input
          type="text"
          value={nazwa}
          disabled={pending}
          onChange={(e) => setNazwa(e.target.value)}
          onBlur={zapiszNazwe}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="Nazwa kolumny"
          aria-label="Nazwa kolumny"
          className={FIELD}
        />
      </div>

      <div className={MENU_LABEL}>Typ pola</div>
      {EDITOR_TYPES.map((t) => {
        // Wybór obejmuje też starsze pola typu select
        const aktualny =
          t.type === field.type || (t.type === "status" && field.type === "select");
        return (
          <button
            key={t.type}
            type="button"
            disabled={field.isTitle || pending}
            aria-disabled={field.isTitle || pending}
            onClick={() => {
              if (!aktualny) onPickType(t.type);
            }}
            className={cn(
              MENU_ITEM,
              "disabled:cursor-not-allowed disabled:opacity-[.64] disabled:hover:bg-transparent",
              aktualny && "bg-accent",
            )}
          >
            <t.Icon size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
            <span className="flex-1">{t.label}</span>
            {aktualny && <Check size={14} aria-hidden="true" className="flex-none" />}
          </button>
        );
      })}

      {jestWyborem && (
        <>
          <div className={cn(MENU_LABEL, "pt-2.5")}>Opcje</div>
          <div className="flex flex-wrap gap-1 px-2">
            {opcje.map((o) => (
              <OptionBadge key={o.id} option={o}>
                <button
                  type="button"
                  aria-label={`Usuń opcję ${o.label}`}
                  disabled={pending}
                  onClick={() => onRemoveOption(o.id)}
                  className="cursor-pointer border-0 bg-transparent p-0 pl-0.5 font-[inherit] text-inherit opacity-60 outline-none focus-visible:shadow-focus max-[799px]:min-h-11 max-[799px]:min-w-11"
                >
                  ×
                </button>
              </OptionBadge>
            ))}
          </div>
          <div className="flex gap-1.5 px-2 pt-2 pb-1">
            <input
              type="text"
              value={nowaOpcja}
              disabled={pending}
              onChange={(e) => setNowaOpcja(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  dodajOpcje();
                }
              }}
              placeholder="Nowa opcja…"
              aria-label="Nowa opcja"
              className={FIELD}
            />
            <Button size="sm" disabled={pending} onClick={dodajOpcje}>
              Dodaj
            </Button>
          </div>
        </>
      )}

      <div className={MENU_SEPARATOR} />
      <div className="flex justify-between px-0.5">
        <Button
          variant="ghost"
          size="xs"
          disabled={index === 0 || pending}
          aria-disabled={index === 0 || pending}
          // Nazwa dostępna zostaje „← W lewo”, widoczna jest ikona strzałki
          aria-label="← W lewo"
          onClick={() => onMove(-1)}
          className="max-[799px]:h-11"
        >
          <ChevronLeft size={14} aria-hidden="true" />W lewo
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={index === count - 1 || pending}
          aria-disabled={index === count - 1 || pending}
          aria-label="W prawo →"
          onClick={() => onMove(1)}
          className="max-[799px]:h-11"
        >
          W prawo
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </div>
      <div className={MENU_SEPARATOR} />
      <button
        type="button"
        disabled={nieMoznaUsunac}
        aria-disabled={nieMoznaUsunac}
        onClick={onDelete}
        className={cn(
          MENU_ITEM,
          MENU_ITEM_DANGER,
          "disabled:cursor-not-allowed disabled:opacity-[.64] disabled:hover:bg-transparent",
        )}
      >
        <Trash2 size={14} aria-hidden="true" className="flex-none" />
        Usuń kolumnę
      </button>
    </ActionPopover>
  );
}
