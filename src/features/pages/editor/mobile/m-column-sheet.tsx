"use client";

import * as React from "react";

import { FormDialog } from "@/components/controls";
import { EDITOR_TYPES, type FieldType, type PageField } from "../../fields";
import { OptionBadge } from "../cell-editor";

// Arkusz „Kolumna” (MEditor.dc.html) zamiast dymka na telefonie: nazwa, „Typ pola” w siatce 2 kolumn,
// „← W lewo / W prawo →”, „Usuń kolumnę” i „Gotowe”. Dla Wyboru dochodzą „Opcje” (makieta ich nie
// ma, ale bez nich Wybór na telefonie nie miałby czego przełączać).
export function MColumnSheet({
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

  const przyciskPrzesuniecia =
    "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#e0e0e0] bg-white font-[inherit] font-medium text-[#171717] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Kolumna"
      footer={
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex h-11 w-full cursor-pointer items-center justify-center rounded-[10px] border border-[#171717] bg-[#171717] font-[inherit] font-semibold text-white"
        >
          Gotowe
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
        aria-label="Nazwa kolumny"
        className="box-border h-12 w-full rounded-[10px] border border-[#e0e0e0] bg-white px-3.5 font-[inherit] text-[15px] text-[#171717] outline-none focus:border-[#171717]"
      />

      <span className="font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase">Typ pola</span>
      <div className="grid grid-cols-2 gap-2">
        {EDITOR_TYPES.map((t) => {
          // Wybór obejmuje też starsze pola typu select
          const aktualny = t.type === field.type || (t.type === "status" && field.type === "select");
          return (
            <button
              key={t.type}
              type="button"
              aria-pressed={aktualny}
              disabled={field.isTitle || pending}
              onClick={() => {
                if (!aktualny) onPickType(t.type);
              }}
              className={`flex h-12 cursor-pointer items-center gap-2 rounded-[10px] border px-3.5 text-left font-[inherit] text-[#171717] disabled:cursor-not-allowed disabled:opacity-40 ${
                aktualny ? "border-[#171717] bg-[#f5f5f5]" : "border-[#e0e0e0] bg-white"
              }`}
            >
              <span aria-hidden="true" className="w-5 font-mono text-[#6b6b6b]">
                {t.icon}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {jestWyborem && (
        <>
          <span className="font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase">Opcje</span>
          <div className="flex flex-wrap gap-1.5">
            {opcje.map((o) => (
              <OptionBadge key={o.id} option={o}>
                <button
                  type="button"
                  aria-label={`Usuń opcję ${o.label}`}
                  disabled={pending}
                  onClick={() => onRemoveOption(o.id)}
                  className="min-h-11 min-w-11 cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-inherit opacity-70"
                >
                  ×
                </button>
              </OptionBadge>
            ))}
          </div>
          <div className="flex gap-2">
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
              className="box-border h-11 min-w-0 flex-1 rounded-[10px] border border-[#e0e0e0] bg-white px-3.5 font-[inherit] text-[15px] text-[#171717] outline-none focus:border-[#171717]"
            />
            <button
              type="button"
              disabled={pending}
              onClick={dodajOpcje}
              className="h-11 cursor-pointer rounded-[10px] border border-[#e0e0e0] bg-white px-4 font-[inherit] text-[#171717] disabled:opacity-50"
            >
              Dodaj
            </button>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={index === 0 || pending}
          onClick={() => onMove(-1)}
          className={przyciskPrzesuniecia}
        >
          ← W lewo
        </button>
        <button
          type="button"
          disabled={index === count - 1 || pending}
          onClick={() => onMove(1)}
          className={przyciskPrzesuniecia}
        >
          W prawo →
        </button>
      </div>
      <button
        type="button"
        disabled={nieMoznaUsunac}
        onClick={onDelete}
        className="flex h-11 w-full cursor-pointer items-center justify-center rounded-[10px] border border-[#f3c7c7] bg-white font-[inherit] font-medium text-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Usuń kolumnę
      </button>
    </FormDialog>
  );
}
