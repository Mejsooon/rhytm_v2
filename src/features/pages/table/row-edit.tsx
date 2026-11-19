"use client";

import { Checkbox, DatePicker, Dropdown, type IsoDate } from "@/components/controls";
import { OptionBadge } from "../editor/cell-editor";
import { normalizeValue, type PageField } from "../fields";

// Wiersz w trybie edycji (Books / Projects / Websites.dc.html, tło #f7fbf8): pola tekstowe,
// listy z plakietką i ✓, wybór daty, gwiazdki; „Zapisz” zapisuje, ✕ anuluje bez zapisu.
export function RowEdit({
  fields,
  values,
  today,
  onChange,
  onSave,
  onCancel,
}: {
  fields: PageField[];
  values: Record<string, unknown>;
  today: IsoDate;
  onChange: (fieldId: string, value: unknown) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="bg-[#f7fbf8]">
      {fields.map((f) => {
        const surowa = values[f.id];
        const td = "border-b border-[#f0f0f0] px-3.5 py-[11px]";

        if (f.type === "status" || f.type === "select") {
          const v = normalizeValue(f, surowa);
          return (
            <td key={f.id} className={td}>
              <Dropdown
                compact
                ariaLabel={f.name}
                placeholder="—"
                width={f.type === "status" ? 190 : 160}
                value={typeof v === "string" ? v : null}
                onChange={(id) => onChange(f.id, id)}
                options={(f.config.options ?? []).map((o) => ({
                  value: o.id,
                  label: o.label,
                  node:
                    f.type === "status" ? (
                      <OptionBadge option={o} />
                    ) : (
                      <span className="rounded-[4px] border border-[#e0e0e0] px-[7px] py-0.5 font-mono text-[11px] whitespace-nowrap text-[#404040]">
                        {o.label}
                      </span>
                    ),
                }))}
              />
            </td>
          );
        }

        if (f.type === "date") {
          const v = normalizeValue(f, surowa);
          return (
            <td key={f.id} className={td}>
              <DatePicker
                size="sm"
                ariaLabel={f.name}
                today={today}
                value={typeof v === "string" ? (v as IsoDate) : null}
                onChange={(d) => onChange(f.id, d)}
              />
            </td>
          );
        }

        if (f.type === "rating") {
          const n = normalizeValue(f, surowa);
          const ocena = typeof n === "number" ? n : 0;
          return (
            <td key={f.id} className={td}>
              <span role="group" aria-label={f.name} className="inline-flex gap-px">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={`Ocena ${k} na 5`}
                    aria-pressed={k <= ocena}
                    // Ponowny klik tej samej oceny ją zeruje
                    onClick={() => onChange(f.id, ocena === k ? null : k)}
                    className={`cursor-pointer border-0 bg-transparent px-px py-0 text-[15px] leading-none ${
                      k <= ocena ? "text-[#171717]" : "text-[#d4d4d4]"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </span>
            </td>
          );
        }

        if (f.type === "checkbox") {
          return (
            <td key={f.id} className={td}>
              <Checkbox
                checked={surowa === true}
                ariaLabel={f.name}
                onChange={(c) => onChange(f.id, c)}
              />
            </td>
          );
        }

        // Tekst, liczba, link: szkic jako tekst, normalizacja dopiero przy zapisie
        const tekst =
          typeof surowa === "string"
            ? surowa
            : typeof surowa === "number"
              ? String(surowa).replace(".", ",")
              : "";
        const podpowiedz = f.isTitle
          ? `${f.name}…`
          : f.type === "url"
            ? f.name === "Repo"
              ? "github.com/…"
              : "adres.pl"
            : f.name;
        return (
          <td
            key={f.id}
            className={`${td} ${f.isTitle ? "font-medium" : ""} ${f.type === "url" || f.type === "number" ? "font-mono" : ""}`}
          >
            <input
              type="text"
              inputMode={f.type === "number" ? "decimal" : undefined}
              value={tekst}
              onChange={(e) => onChange(f.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
                if (e.key === "Escape") onCancel();
              }}
              placeholder={podpowiedz}
              aria-label={f.name}
              autoFocus={f.isTitle}
              className="w-full min-w-0 border-0 bg-transparent p-0 font-[inherit] text-[#171717] outline-none placeholder:text-[#a3a3a3]"
            />
          </td>
        );
      })}
      <td className="border-b border-[#f0f0f0] px-3.5 py-[11px] text-right whitespace-nowrap">
        <button
          type="button"
          onClick={onSave}
          className="cursor-pointer rounded-md border border-[#171717] bg-[#171717] px-2.5 py-1 font-[inherit] text-xs font-medium text-white"
        >
          Zapisz
        </button>
        <button
          type="button"
          aria-label="Anuluj"
          onClick={onCancel}
          className="ml-1 cursor-pointer border-0 bg-transparent px-1.5 py-1 font-[inherit] text-[#666666]"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
