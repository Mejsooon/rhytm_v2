"use client";

import * as React from "react";

import { ActionPopover } from "@/components/controls";
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
  // Ikona nagłówka: dla Wyboru ◐, dla Checkboxa ☑ (jak lista typów w dymku)
  const ikona = EDITOR_TYPES.find((t) => t.type === field.type)?.icon ?? meta.icon;
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
      width={260}
      ariaLabel="Ustawienia kolumny"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`-mx-1 -my-0.5 inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] border-0 px-1 py-0.5 font-[inherit] font-medium whitespace-nowrap hover:bg-[#efefef] hover:text-[#171717] max-[799px]:min-h-11 ${
            open ? "bg-[#efefef] text-[#171717]" : "bg-transparent text-[#666666]"
          }`}
        >
          <span aria-hidden="true" className="font-mono text-[#6b6b6b]">
            {ikona}
          </span>
          {field.name}
        </button>
      }
    >
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
        className="box-border w-full rounded-md border border-[#e0e0e0] bg-white px-2 py-1.5 font-[inherit] text-[13px] text-[#171717] outline-none focus:border-[#171717] max-[799px]:min-h-11"
      />

      <div className="px-2 pt-3 pb-1 font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase">
        Typ pola
      </div>
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
            className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 px-2 py-1.5 text-left font-[inherit] text-[13px] text-[#171717] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent max-[799px]:min-h-11 ${
              aktualny ? "bg-[#f0f0f0] font-medium" : "bg-transparent"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="w-[18px] font-mono text-[#6b6b6b]">
                {t.icon}
              </span>
              {t.label}
            </span>
            <span aria-hidden="true" className="text-[#15803d]">
              {aktualny ? "✓" : ""}
            </span>
          </button>
        );
      })}

      {jestWyborem && (
        <>
          <div className="px-2 pt-3 pb-1.5 font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase">
            Opcje
          </div>
          <div className="flex flex-wrap gap-1 px-2">
            {opcje.map((o) => (
              <OptionBadge key={o.id} option={o}>
                <button
                  type="button"
                  aria-label={`Usuń opcję ${o.label}`}
                  disabled={pending}
                  onClick={() => onRemoveOption(o.id)}
                  className="cursor-pointer border-0 bg-transparent p-0 pl-0.5 font-[inherit] text-inherit opacity-70 max-[799px]:min-h-11 max-[799px]:min-w-11"
                >
                  ×
                </button>
              </OptionBadge>
            ))}
          </div>
          <div className="flex gap-1.5 px-2 pt-2">
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
              className="box-border w-full min-w-0 rounded-md border border-[#e0e0e0] bg-white px-2 py-1.5 font-[inherit] text-[13px] text-[#171717] outline-none focus:border-[#171717] max-[799px]:min-h-11"
            />
            <button
              type="button"
              disabled={pending}
              onClick={dodajOpcje}
              className="cursor-pointer rounded-md border border-[#e0e0e0] bg-white px-2.5 py-[5px] font-[inherit] text-xs text-[#171717] hover:bg-[#fafafa] disabled:opacity-50 max-[799px]:min-h-11"
            >
              Dodaj
            </button>
          </div>
        </>
      )}

      <div className="mt-2.5 flex justify-between border-t border-[#f0f0f0] pt-1.5">
        <button
          type="button"
          disabled={index === 0 || pending}
          aria-disabled={index === 0 || pending}
          onClick={() => onMove(-1)}
          className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 font-[inherit] text-xs text-[#404040] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent max-[799px]:min-h-11"
        >
          ← W lewo
        </button>
        <button
          type="button"
          disabled={index === count - 1 || pending}
          aria-disabled={index === count - 1 || pending}
          onClick={() => onMove(1)}
          className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 font-[inherit] text-xs text-[#404040] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent max-[799px]:min-h-11"
        >
          W prawo →
        </button>
      </div>
      <button
        type="button"
        disabled={nieMoznaUsunac}
        aria-disabled={nieMoznaUsunac}
        onClick={onDelete}
        className="mt-1 flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-2 py-1.5 text-left font-[inherit] text-[13px] text-[#b91c1c] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent max-[799px]:min-h-11"
      >
        Usuń kolumnę
      </button>
    </ActionPopover>
  );
}
