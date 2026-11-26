"use client";

import * as React from "react";
import { CircleCheck, Copy, Download, Trash2, X } from "lucide-react";

import { ActionPopover, MENU_ITEM, MENU_LABEL } from "@/components/controls";
import { cn } from "@/lib/utils";
import type { PageField } from "../fields";
import { rowsForm } from "../rows-label";
import { OptionBadge } from "./option-badge";

// Przycisk paska (.bulk > button): 30 px, jasny tekst na ciemnym tle, podświetlenie 10 %
const PRZYCISK =
  "inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 font-[inherit] font-medium whitespace-nowrap text-[#fafafa] outline-none hover:bg-white/10 focus-visible:shadow-focus aria-expanded:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";
// Kreska między grupami przycisków (.bulk .sep)
const KRESKA = "mx-1 h-[18px] w-px bg-white/20";

// Pasek akcji dla zaznaczonych wierszy (S2Table, .bulk): ciemna pigułka na dole ekranu z liczbą zaznaczonych,
// „Zmień: pole” (menu opcji pola grupy albo pierwszego pola wyboru), Duplikuj, Eksport CSV, Usuń i ✕ (odznacz).
// `field` to pole Wyboru, Statusu albo Checkbox (nigdy Sekret); null = bez „Zmień”.
// „Eksport CSV” bez obsługi (onExportCsv) jest wyłączony.
export function BulkBar({
  count,
  field,
  onSetValue,
  onDuplicate,
  onExportCsv,
  onDelete,
  onClear,
}: {
  count: number;
  field: PageField | null;
  // Wartość do zapisu (id opcji albo true / false) i jej etykieta do tostu
  onSetValue: (value: unknown, label: string) => void;
  onDuplicate: () => void;
  onExportCsv?: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [menu, setMenu] = React.useState(false);
  const forma = rowsForm(count);
  const tekst = `${count} ${forma === "one" ? "zaznaczony" : forma === "few" ? "zaznaczone" : "zaznaczonych"}`;
  // Opcje „Zmień”: opcje pola wyboru albo Zaznaczone / Niezaznaczone dla checkboxa
  const opcje =
    field === null || field.type === "secret"
      ? []
      : field.type === "checkbox"
        ? [
            { id: "true", label: "Zaznaczone", color: "", wartosc: true as unknown },
            { id: "false", label: "Niezaznaczone", color: "", wartosc: false as unknown },
          ]
        : (field.config.options ?? []).map((o) => ({ ...o, wartosc: o.id as unknown }));

  return (
    <div
      role="toolbar"
      aria-label="Akcje dla zaznaczonych"
      className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-xl bg-[#262626] p-1.5 text-[13px] text-[#fafafa] shadow-[0_8px_24px_rgba(0,0,0,.2)]"
    >
      <span className="pr-2 pl-2.5 font-medium tabular-nums">{tekst}</span>
      <span aria-hidden="true" className={KRESKA} />
      {field !== null && opcje.length > 0 && (
        <ActionPopover
          open={menu}
          onOpenChange={setMenu}
          side="top"
          width={220}
          className="p-1"
          ariaLabel={`Zmień: ${field.name}`}
          trigger={
            <button type="button" aria-haspopup="menu" aria-expanded={menu} className={PRZYCISK}>
              <CircleCheck aria-hidden="true" className="size-3.5" />
              Zmień: {field.name}
            </button>
          }
        >
          <div role="menu" aria-label="Ustaw dla zaznaczonych">
            <div className={MENU_LABEL}>{field.name}</div>
            {opcje.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  onSetValue(o.wartosc, o.label);
                }}
                className={MENU_ITEM}
              >
                {field.type === "checkbox" ? o.label : <OptionBadge option={o} />}
              </button>
            ))}
          </div>
        </ActionPopover>
      )}
      <button type="button" onClick={onDuplicate} className={PRZYCISK}>
        <Copy aria-hidden="true" className="size-3.5" />
        Duplikuj
      </button>
      <button type="button" disabled={!onExportCsv} onClick={() => onExportCsv?.()} className={PRZYCISK}>
        <Download aria-hidden="true" className="size-3.5" />
        Eksport CSV
      </button>
      <button type="button" onClick={onDelete} className={cn(PRZYCISK, "text-[#fca5a5]")}>
        <Trash2 aria-hidden="true" className="size-3.5" />
        Usuń
      </button>
      <span aria-hidden="true" className={KRESKA} />
      <button type="button" aria-label="Odznacz wszystkie" onClick={onClear} className={cn(PRZYCISK, "px-2")}>
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
