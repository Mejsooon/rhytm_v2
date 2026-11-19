"use client";

import { OptionBadge } from "../editor/cell-editor";
import { formatValue, isUrgent, normalizeValue, relativeDue, type PageField } from "../fields";
import type { PageRow } from "../table-model";

// Wiersz w podglądzie (Books / Projects / Websites.dc.html): klik otwiera edycję,
// „Edytuj” / „Usuń” pojawiają się po najechaniu w ostatniej kolumnie.
export function RowPreview({
  row,
  fields,
  today,
  done,
  onOpen,
  onEdit,
  onDelete,
}: {
  row: PageRow;
  fields: PageField[];
  today: string;
  // Opcja „zrobione” z karty najbliższego terminu — zrobione terminy nie są pilne
  done: { fieldId: string; optionId: string } | null;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const zrobiony = done !== null && row.values[done.fieldId] === done.optionId;

  return (
    <tr onClick={onOpen} className="group/row cursor-pointer [&:hover>td]:bg-[#fafafa]">
      {fields.map((f) => {
        const v = normalizeValue(f, row.values[f.id]);
        const td = "border-b border-[#f0f0f0] px-3.5 py-[11px]";

        if (f.isTitle) {
          return (
            <td key={f.id} className={`${td} font-medium`}>
              {typeof v === "string" ? v : (f.config.empty_label ?? "Bez tytułu")}
            </td>
          );
        }

        if (f.type === "status" || f.type === "select") {
          const opcja = (f.config.options ?? []).find((o) => o.id === v);
          return (
            <td key={f.id} className={td}>
              {opcja ? (
                f.type === "status" ? (
                  <OptionBadge option={opcja} />
                ) : (
                  // Select: etykieta mono w ramce (AREA z Projects.dc.html)
                  <span className="rounded-[4px] border border-[#e0e0e0] px-[7px] py-0.5 font-mono text-[11px] whitespace-nowrap text-[#404040]">
                    {opcja.label}
                  </span>
                )
              ) : (
                <span className="font-mono text-[#a3a3a3]">—</span>
              )}
            </td>
          );
        }

        if (f.type === "rating") {
          const n = typeof v === "number" ? v : 0;
          return (
            <td
              key={f.id}
              aria-label={n ? `Ocena ${n} na 5` : "Brak oceny"}
              className={`${td} font-mono tracking-[0.1em]`}
            >
              <span className="text-[#171717]">{"★".repeat(n)}</span>
              <span className="text-[#d4d4d4]">{n ? "★".repeat(5 - n) : "—"}</span>
            </td>
          );
        }

        if (f.type === "date") {
          // Termin w kalendarzu pokazuje też czas do terminu (Projects.dc.html)
          const wzgledna =
            typeof v === "string" && f.config.show_in_calendar === true
              ? relativeDue(v, today).text
              : "";
          const pilny = typeof v === "string" && isUrgent(v, today, zrobiony);
          return (
            <td key={f.id} className={`${td} font-mono whitespace-nowrap text-[#404040]`}>
              {typeof v === "string" ? formatValue(f, v) : "—"}
              {wzgledna && (
                <>
                  {" "}
                  <span className={`ml-1.5 ${pilny ? "text-[#b91c1c]" : "text-[#6b6b6b]"}`}>
                    {wzgledna}
                  </span>
                </>
              )}
            </td>
          );
        }

        if (f.type === "url") {
          const adres = typeof v === "string" ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null;
          return (
            <td key={f.id} className={`${td} font-mono`}>
              {adres ? (
                <a
                  href={adres}
                  target="_blank"
                  rel="noopener noreferrer"
                  // Link nie otwiera edycji wiersza
                  onClick={(e) => e.stopPropagation()}
                  className="border-b border-[#e0e0e0] text-[#404040] no-underline hover:text-[#000000]"
                >
                  {formatValue(f, v)}
                </a>
              ) : (
                <span className="text-[#404040]">—</span>
              )}
            </td>
          );
        }

        if (f.type === "checkbox") {
          return (
            <td key={f.id} className={`${td} font-mono text-[#15803d]`}>
              {v === true ? "✓" : ""}
            </td>
          );
        }

        // Tekst i liczba
        return (
          <td key={f.id} className={`${td} text-[#404040] ${f.type === "number" ? "font-mono" : ""}`}>
            {v === null ? "—" : formatValue(f, v)}
          </td>
        );
      })}
      <td className="border-b border-[#f0f0f0] px-3.5 py-[11px] text-right whitespace-nowrap">
        <button
          type="button"
          aria-label="Edytuj wiersz"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent px-1.5 py-1 font-[inherit] text-xs text-[#404040] opacity-0 transition-opacity duration-[120ms] group-hover/row:opacity-100 focus-visible:opacity-100 max-[799px]:hidden"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Edytuj
        </button>
        <button
          type="button"
          aria-label="Usuń wiersz"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent px-1.5 py-1 font-[inherit] text-xs text-[#b91c1c] opacity-0 transition-opacity duration-[120ms] group-hover/row:opacity-100 focus-visible:opacity-100 max-[799px]:hidden"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          Usuń
        </button>
      </td>
    </tr>
  );
}
