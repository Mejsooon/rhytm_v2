"use client";

import {
  Button,
  Checkbox,
  DatePicker,
  Dropdown,
  FormDialog,
  TextField,
  type IsoDate,
} from "@/components/controls";
import { OptionBadge } from "../option-badge";
import { normalizeValue, type PageField } from "../../fields";

// Arkusz wiersza na telefonie (FormDialog poniżej 800 px): te same kontrolki co tryb edycji,
// „Usuń wiersz” (tylko istniejący wiersz) i „Anuluj” / „Zapisz” (MRowEdit.dc.html).
export function MRowSheet({
  open,
  title,
  fields,
  values,
  today,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  open: boolean;
  title: string;
  fields: PageField[];
  values: Record<string, unknown>;
  today: IsoDate;
  onChange: (fieldId: string, value: unknown) => void;
  onSave: () => void;
  onCancel: () => void;
  // Brak dla nowego wiersza
  onDelete?: () => void;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Anuluj</Button>
          <Button variant="primary" onClick={onSave}>
            Zapisz
          </Button>
        </>
      }
    >
      {fields.map((f) => {
        const surowa = values[f.id];

        // Sekret nie jest edytowalny jako zwykły tekst (tekst jawny nie może trafić do stanu ani na serwer)
        if (f.type === "secret") return null;

        if (f.type === "status" || f.type === "select") {
          const v = normalizeValue(f, surowa);
          return (
            <div key={f.id} className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <Dropdown
                ariaLabel={f.name}
                placeholder="—"
                value={typeof v === "string" ? v : null}
                onChange={(id) => onChange(f.id, id)}
                options={(f.config.options ?? []).map((o) => ({
                  value: o.id,
                  label: o.label,
                  node:
                    f.type === "status" ? (
                      <OptionBadge option={o} />
                    ) : (
                      <span className="rounded-[4px] border border-input px-[7px] py-0.5 font-mono text-[11px] whitespace-nowrap text-soft-foreground">
                        {o.label}
                      </span>
                    ),
                }))}
              />
            </div>
          );
        }

        if (f.type === "date") {
          const v = normalizeValue(f, surowa);
          return (
            <div key={f.id} className="flex flex-col items-start gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <DatePicker
                ariaLabel={f.name}
                today={today}
                value={typeof v === "string" ? (v as IsoDate) : null}
                onChange={(d) => onChange(f.id, d)}
              />
            </div>
          );
        }

        if (f.type === "rating") {
          const n = normalizeValue(f, surowa);
          const ocena = typeof n === "number" ? n : 0;
          return (
            <div key={f.id} className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <span role="group" aria-label={f.name} className="inline-flex">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={`Ocena ${k} na 5`}
                    aria-pressed={k <= ocena}
                    onClick={() => onChange(f.id, ocena === k ? null : k)}
                    className={`size-11 cursor-pointer border-0 bg-transparent p-0 text-[22px] leading-none ${
                      k <= ocena ? "text-foreground" : "text-faint-foreground"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </span>
            </div>
          );
        }

        if (f.type === "checkbox") {
          return (
            <div key={f.id} className="flex min-h-11 items-center">
              <Checkbox
                checked={surowa === true}
                label={f.name}
                onChange={(c) => onChange(f.id, c)}
              />
            </div>
          );
        }

        const tekst =
          typeof surowa === "string"
            ? surowa
            : typeof surowa === "number"
              ? String(surowa).replace(".", ",")
              : "";
        return (
          <TextField
            key={f.id}
            label={f.name}
            value={tekst}
            inputMode={f.type === "number" ? "decimal" : undefined}
            placeholder={f.isTitle ? (f.config.empty_label ?? "Bez tytułu") : ""}
            onChange={(e) => onChange(f.id, e.target.value)}
            className={f.type === "url" || f.type === "number" ? "font-mono" : undefined}
          />
        );
      })}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-1 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-destructive-border bg-white font-[inherit] font-medium text-destructive-foreground hover:bg-panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          Usuń wiersz
        </button>
      )}
    </FormDialog>
  );
}
