"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button, StatusBadge } from "@/components/controls";
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
    // .tbl: wiersz 44 px, najechanie podświetla komórki o 2 %, ostatni wiersz bez dolnej linii
    <tr onClick={onOpen} className="group/wiersz cursor-pointer [&:hover>td]:bg-black/[.02]">
      {fields.map((f) => {
        const v = normalizeValue(f, row.values[f.id]);
        // Długie wartości są obcinane wielokropkiem (limit szerokości na elemencie wewnętrznym, bo max-w na td jest ignorowane przy table-layout:auto), a tabela przewija się poziomo
        const td = "h-11 border-b border-border px-3 group-last/wiersz:border-b-0";

        if (f.isTitle) {
          return (
            <td key={f.id} className={`${td} font-medium`}>
              <span className="block max-w-[280px] truncate">
                {typeof v === "string" ? v : (f.config.empty_label ?? "Bez tytułu")}
              </span>
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
                  // Select: odznaka z ramką (.bdg.out, „Obszar” z CProjects.dc.html)
                  <StatusBadge tone="outline">{opcja.label}</StatusBadge>
                )
              ) : (
                <span className="text-faint-foreground">—</span>
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
              className={`${td} text-[15px] tracking-[0.08em]`}
            >
              {/* Gwiazdki: wypełnione bursztynowe, puste jasnoszare (CBooks.dc.html) */}
              <span className="text-warning">{"★".repeat(n)}</span>
              <span className="text-black/[.14]">{n ? "★".repeat(5 - n) : "—"}</span>
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
            <td key={f.id} className={`${td} whitespace-nowrap text-soft-foreground tabular-nums`}>
              {typeof v === "string" ? formatValue(f, v) : "—"}
              {wzgledna && (
                <>
                  {" "}
                  {/* Pilny termin to czerwona odznaka (.bdg.bad), reszta zwykły szary tekst */}
                  {pilny ? (
                    <StatusBadge tone="red" className="ml-1.5">
                      {wzgledna}
                    </StatusBadge>
                  ) : (
                    <span className="ml-1.5 text-muted-foreground">{wzgledna}</span>
                  )}
                </>
              )}
            </td>
          );
        }

        if (f.type === "url") {
          const adres = typeof v === "string" ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null;
          return (
            <td key={f.id} className={`${td} tabular-nums`}>
              {adres ? (
                <a
                  href={adres}
                  target="_blank"
                  rel="noopener noreferrer"
                  // Link nie otwiera edycji wiersza
                  onClick={(e) => e.stopPropagation()}
                  className="block truncate rounded-sm text-soft-foreground underline decoration-black/20 underline-offset-[3px] outline-none hover:text-foreground focus-visible:shadow-focus"
                >
                  {formatValue(f, v)}
                </a>
              ) : (
                <span className="text-soft-foreground">—</span>
              )}
            </td>
          );
        }

        if (f.type === "checkbox") {
          return (
            <td key={f.id} className={td}>
              {/* Zaznaczone: kwadrat jak .cbx (16 px) z ✓; puste pole bez znacznika, jak dotąd */}
              {v === true ? (
                <span
                  className="inline-flex size-4 items-center justify-center rounded-[4px] border border-primary bg-primary text-xs leading-none text-primary-foreground"
                >
                  ✓
                </span>
              ) : (
                ""
              )}
            </td>
          );
        }

        // Tekst i liczba
        return (
          <td
            key={f.id}
            className={`${td} text-soft-foreground ${f.type === "number" ? "text-right tabular-nums" : ""}`}
          >
            <span className="block truncate">{v === null ? "—" : formatValue(f, v)}</span>
          </td>
        );
      })}
      {/* Akcje pojawiają się po najechaniu na wiersz (.row-del + .btng.xs) */}
      <td className="h-11 border-b border-border px-3 text-right whitespace-nowrap group-last/wiersz:border-b-0">
        <Button
          variant="ghost"
          size="xs"
          aria-label="Edytuj wiersz"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="opacity-0 transition-opacity duration-[120ms] group-hover/wiersz:opacity-100 focus-visible:opacity-100 max-[799px]:hidden"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Edytuj
        </Button>
        <Button
          variant="ghost"
          size="xs"
          aria-label="Usuń wiersz"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-destructive-foreground opacity-0 transition-opacity duration-[120ms] group-hover/wiersz:opacity-100 hover:text-destructive-foreground focus-visible:opacity-100 max-[799px]:hidden"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
          Usuń
        </Button>
      </td>
    </tr>
  );
}
