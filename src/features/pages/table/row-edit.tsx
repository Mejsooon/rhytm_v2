"use client";

import * as React from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Button, Checkbox, DatePicker, Dropdown, FIELD, StatusBadge, type IsoDate } from "@/components/controls";
import { SecretEdit } from "@/features/vault/secret-cell";
import { useVault } from "@/features/vault/vault-provider";
import { cn } from "@/lib/utils";
import { OptionBadge } from "../editor/cell-editor";
import { normalizeValue, type PageField } from "../fields";
import { SEJF_ZABLOKOWANY } from "../messages";

// Wiersz w trybie edycji (CBooks / CProjects / CWebsites.dc.html, tło zieleni 4 %): pola tekstowe,
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
  // nadpisane: zaszyfrowane wartości pól Sekret zmienionych w tym wierszu (SecretValue albo null)
  onSave: (nadpisane: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const vault = useVault();
  // Tekst jawny pól Sekret żyje tylko tu (stan komponentu): nie trafia do stanu tabeli ani do serwera.
  // Na zapis idzie wyłącznie wynik vault.encrypt.
  const [teksty, setTeksty] = React.useState<Record<string, string>>({});
  const [zmienione, setZmienione] = React.useState<Record<string, boolean>>({});
  const [poprzedniStatus, setPoprzedniStatus] = React.useState(vault.status);
  if (poprzedniStatus !== vault.status) {
    setPoprzedniStatus(vault.status);
    // Blokada zrzuca wpisany tekst: po ponownym odblokowaniu pole zaczyna od wartości z wiersza
    if (vault.status !== "odblokowany") {
      setTeksty({});
      setZmienione({});
    }
  }
  // Wartość początkowa z odszyfrowania nie nadpisuje tego, co użytkownik już wpisał
  const uzupelnij = React.useCallback((fieldId: string, tekst: string) => {
    setTeksty((s) => (fieldId in s ? s : { ...s, [fieldId]: tekst }));
  }, []);

  // „Zapisz”: pola Sekret zmienione przez użytkownika szyfrujemy tutaj, przed przekazaniem wyżej
  async function zapisz() {
    const nadpisane: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type !== "secret" || !zmienione[f.id]) continue;
      const tekst = teksty[f.id] ?? "";
      if (tekst === "") {
        nadpisane[f.id] = null;
        continue;
      }
      try {
        nadpisane[f.id] = await vault.encrypt(tekst);
      } catch {
        // Komunikat stały: nigdy z treścią błędu ani tekstem jawnym
        toast.error(SEJF_ZABLOKOWANY);
        return;
      }
    }
    onSave(nadpisane);
  }

  return (
    <tr className="group/wiersz bg-success-soft/50">
      {fields.map((f) => {
        const surowa = values[f.id];
        const td = "h-11 border-b border-border px-3 group-last/wiersz:border-b-0";

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
                      <StatusBadge tone="outline">{o.label}</StatusBadge>
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
                    className={`cursor-pointer rounded-sm border-0 bg-transparent px-px py-0 text-[15px] leading-none outline-none focus-visible:shadow-focus ${
                      k <= ocena ? "text-warning" : "text-black/[.14]"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </span>
            </td>
          );
        }

        // Sekret: tekst wpisany lokalnie, szyfrowany przy „Zapisz”; zablokowany sejf wyłącza pole
        if (f.type === "secret") {
          return (
            <td key={f.id} className={td}>
              <SecretEdit
                fieldId={f.id}
                label={f.name}
                source={surowa}
                text={teksty[f.id] ?? ""}
                onText={(t) => {
                  setTeksty((s) => ({ ...s, [f.id]: t }));
                  setZmienione((s) => ({ ...s, [f.id]: true }));
                }}
                onPrefill={uzupelnij}
                onSubmit={() => void zapisz()}
                onCancel={onCancel}
              />
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
            className={`${td} ${f.isTitle ? "font-medium" : ""} ${f.type === "url" || f.type === "number" ? "tabular-nums" : ""}`}
          >
            <input
              type="text"
              inputMode={f.type === "number" ? "decimal" : undefined}
              value={tekst}
              onChange={(e) => onChange(f.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void zapisz();
                if (e.key === "Escape") onCancel();
              }}
              placeholder={podpowiedz}
              aria-label={f.name}
              autoFocus={f.isTitle}
              // .inp 30 px (na telefonie 44 px); liczby do prawej
              className={cn(FIELD, "h-[30px]", f.type === "number" && "text-right")}
            />
          </td>
        );
      })}
      <td className="h-11 border-b border-border px-3 text-right whitespace-nowrap group-last/wiersz:border-b-0">
        <Button variant="primary" size="xs" onClick={() => void zapisz()}>
          Zapisz
        </Button>
        <Button variant="ghost" size="xs" icon aria-label="Anuluj" onClick={onCancel} className="ml-1 text-muted-foreground max-[799px]:size-11">
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </td>
    </tr>
  );
}
