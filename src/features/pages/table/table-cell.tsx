"use client";

import * as React from "react";

import { ActionPopover, Checkbox, DatePicker, StatusBadge, type IsoDate } from "@/components/controls";
import { cn } from "@/lib/utils";
import { OptionBadge } from "./option-badge";
import { OptionPicker } from "./option-picker";
import { formatValue, isUrgent, normalizeValue, relativeDue, type PageField } from "../fields";
import type { PageRow } from "../table-model";

// Przerwa w pisaniu, po której szkic tekstu trafia do zapisu
const OPOZNIENIE_ZAPISU = 600;

// Komórka .td z S2Books.dc.html: wiersz 44 px, dolna linia (bez niej w ostatnim wierszu), najechanie podświetla o 2 %
const TD = "h-11 border-b border-border group-last/wiersz:border-b-0 hover:bg-black/[.02]";
// Komórka w edycji (.celltxt:focus-within): niebieska obwódka do środka i białe tło
const OBWODKA = "focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]";

// Jedna komórka tabeli edytowana wprost, jak w Notion (S2Books.dc.html). Tekst, liczba i link to stałe
// pole bez ramki: zapis po 600 ms przerwy oraz od razu przy Enter, Esc, wyjściu i odmontowaniu.
// Gwiazdki, checkbox i data zapisują od razu. Select i status pokazują plakietkę (klik otwiera okienko opcji).
export function TableCell({
  row,
  field,
  today,
  done,
  autoFocus = false,
  onSave,
  onFocused,
  onCreateOption,
  onUpdateOption,
  onRemoveOption,
}: {
  row: PageRow;
  field: PageField;
  today: IsoDate;
  // Opcja „zrobione” z karty najbliższego terminu — zrobione terminy nie są pilne
  done: { fieldId: string; optionId: string } | null;
  // Kursor w tej komórce (tytuł nowego wiersza po „+ Nowy”)
  autoFocus?: boolean;
  onSave: (value: unknown) => void;
  // Wołane po fokusie pola (np. by wyczyścić „kursor w nowym wierszu”)
  onFocused?: () => void;
  // Opcje select/status tworzone, zmieniane i usuwane z okienka komórki
  onCreateOption?: (label: string) => Promise<string | null>;
  onUpdateOption?: (id: string, patch: { label?: string; color?: string }) => void;
  onRemoveOption?: (id: string) => void;
}) {
  const v = normalizeValue(field, row.values[field.id]);

  // Szkic tekstu w komórce z fokusem; null = komórka pokazuje wartość z magazynu.
  // Dopóki komórka ma fokus, nowa wartość z serwera nie nadpisuje tego, co się pisze.
  const [szkic, setSzkic] = React.useState<string | null>(null);
  const poleRef = React.useRef<HTMLInputElement>(null);
  // Okienko opcji (select i status)
  const [okienko, setOkienko] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Wpisany, a jeszcze niezapisany tekst (null = nic do zapisu) i najnowsze onSave — dla zapisu przy odmontowaniu
  const niezapisany = React.useRef<string | null>(null);
  const zapisz = React.useRef(onSave);
  React.useEffect(() => {
    zapisz.current = onSave;
  });

  // Kursor w komórce, gdy dostanie autoFocus (także po zamontowaniu, gdy wiersz pojawił się wcześniej)
  React.useEffect(() => {
    if (autoFocus) poleRef.current?.focus();
  }, [autoFocus]);

  // Odmontowanie (np. wiersz zniknął z filtra) zapisuje ostatni szkic
  React.useEffect(() => {
    const t = timer;
    const n = niezapisany;
    const z = zapisz;
    return () => {
      if (t.current) clearTimeout(t.current);
      if (n.current !== null) z.current(n.current);
      n.current = null;
    };
  }, []);

  // Zapis szkicu teraz (Enter, Esc, wyjście z komórki, koniec przerwy w pisaniu)
  function zapiszSzkic() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const tekst = niezapisany.current;
    niezapisany.current = null;
    if (tekst !== null) zapisz.current(tekst);
  }

  // Sekret: tylko do odczytu (kropki); szyfrogramu nigdy nie pokazujemy
  if (field.type === "secret") {
    return (
      <td className={cn(TD, "px-3 text-soft-foreground")}>
        {v === null ? <span className="text-faint-foreground">—</span> : "••••••••"}
      </td>
    );
  }

  if (field.type === "status" || field.type === "select") {
    const opcja = (field.config.options ?? []).find((o) => o.id === v);
    return (
      // Otwarte okienko (aria-expanded na wyzwalaczu) daje niebieską obwódkę komórki, jak w edycji
      <td
        className={cn(
          TD,
          "p-0 has-[[aria-expanded=true]]:bg-white has-[[aria-expanded=true]]:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]",
        )}
      >
        <ActionPopover
          open={okienko}
          onOpenChange={setOkienko}
          width={240}
          className="p-1"
          ariaLabel={field.name}
          trigger={
            <button
              type="button"
              aria-label={field.name}
              className="flex h-11 w-full cursor-pointer items-center border-0 bg-transparent px-3 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]"
            >
              {opcja ? <OptionBadge option={opcja} /> : <span className="text-faint-foreground">—</span>}
            </button>
          }
        >
          <OptionPicker
            field={field}
            value={typeof v === "string" ? v : null}
            onPick={(id) => {
              onSave(id);
              setOkienko(false);
            }}
            onCreate={(label) => onCreateOption?.(label) ?? Promise.resolve(null)}
            onUpdate={(id, patch) => onUpdateOption?.(id, patch)}
            onRemove={(id) => onRemoveOption?.(id)}
          />
        </ActionPopover>
      </td>
    );
  }

  if (field.type === "rating") {
    const ocena = typeof v === "number" ? v : 0;
    return (
      <td className={cn(TD, "px-3")}>
        <span role="group" aria-label={field.name} className="inline-flex gap-px">
          {[1, 2, 3, 4, 5].map((k) => (
            <button
              key={k}
              type="button"
              aria-label={`Ocena ${k} na 5`}
              aria-pressed={k <= ocena}
              // Kliknięcie bieżącej oceny ją zeruje
              onClick={() => onSave(ocena === k ? null : k)}
              className={cn(
                "cursor-pointer rounded-sm border-0 bg-transparent px-px py-0 text-[15px] leading-none outline-none focus-visible:shadow-focus",
                k <= ocena ? "text-warning" : "text-black/[.14]",
              )}
            >
              ★
            </button>
          ))}
        </span>
      </td>
    );
  }

  if (field.type === "checkbox") {
    return (
      <td className={cn(TD, "px-3")}>
        <Checkbox checked={v === true} ariaLabel={field.name} onChange={(c) => onSave(c)} />
      </td>
    );
  }

  if (field.type === "date") {
    const zrobiony = done !== null && row.values[done.fieldId] === done.optionId;
    // Termin w kalendarzu pokazuje też czas do terminu; pilny to czerwona odznaka (.bdg.bad)
    const wzgledna = typeof v === "string" && field.config.show_in_calendar === true ? relativeDue(v, today).text : "";
    const pilny = typeof v === "string" && isUrgent(v, today, zrobiony);
    return (
      // Otwarty kalendarz (aria-expanded na wyzwalaczu) też daje niebieską obwódkę komórki
      <td
        className={cn(
          TD,
          "p-0 has-[[aria-expanded=true]]:bg-white has-[[aria-expanded=true]]:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]",
        )}
      >
        <div className="flex h-11 items-center whitespace-nowrap">
          <DatePicker
            variant="bare"
            ariaLabel={field.name}
            placeholder="—"
            today={today}
            value={typeof v === "string" ? (v as IsoDate) : null}
            onChange={(d) => onSave(d)}
            // Wyzwalacz na całą komórkę; fokus z klawiatury jak komórka w edycji
            className="h-11 min-w-0 flex-1 justify-start rounded-none pr-2 pl-3 text-sm tabular-nums focus-visible:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]"
          />
          {wzgledna &&
            (pilny ? (
              <StatusBadge tone="red" className="mr-3">
                {wzgledna}
              </StatusBadge>
            ) : (
              <span className="mr-3 text-muted-foreground">{wzgledna}</span>
            ))}
        </div>
      </td>
    );
  }

  // Tekst, liczba i link: stałe pole bez ramki, wyglądające jak tekst
  const tekstWidoku = field.type === "text" ? (typeof v === "string" ? v : "") : formatValue(field, v);
  const tekstEdycji =
    v === null ? "" : field.type === "number" ? String(v).replace(".", ",") : String(v);
  const adres =
    field.type === "url" && typeof v === "string" ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null;
  // Link poza edycją leży nad polem: klik w link otwiera adres, klik obok stawia kursor w polu
  const pokazLink = adres !== null && szkic === null;

  return (
    <td
      className={cn(
        TD,
        "relative cursor-text p-0",
        OBWODKA,
        field.isTitle ? "font-medium text-foreground" : "text-soft-foreground",
        (field.type === "number" || field.type === "url") && "tabular-nums",
      )}
    >
      <input
        ref={poleRef}
        type="text"
        inputMode={field.type === "number" ? "decimal" : undefined}
        aria-label={field.name}
        value={szkic ?? tekstWidoku}
        placeholder={field.isTitle ? (field.config.empty_label ?? "Bez tytułu") : "—"}
        onFocus={() => {
          setSzkic(tekstEdycji);
          onFocused?.();
        }}
        onChange={(e) => {
          const t = e.target.value;
          setSzkic(t);
          // Niepoprawna liczba nie idzie do zapisu: po wyjściu komórka wraca do poprzedniej wartości
          const zla = field.type === "number" && t.trim() !== "" && normalizeValue(field, t) === null;
          niezapisany.current = zla ? null : t;
          if (timer.current) clearTimeout(timer.current);
          timer.current = zla ? null : setTimeout(zapiszSzkic, OPOZNIENIE_ZAPISU);
        }}
        onBlur={() => {
          zapiszSzkic();
          setSzkic(null);
        }}
        onKeyDown={(e) => {
          // Enter i Esc kończą edycję (zapis robi wyjście z komórki)
          if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "block h-11 w-full min-w-0 truncate rounded-none border-0 bg-transparent px-3 py-0 font-[inherit] text-inherit shadow-none outline-none placeholder:font-normal placeholder:text-faint-foreground focus:shadow-none focus-visible:shadow-none",
          field.type === "number" && "text-right",
          pokazLink && "text-transparent",
        )}
      />
      {pokazLink && (
        <a
          href={adres}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-1/2 left-3 block max-w-[calc(100%-24px)] -translate-y-1/2 truncate rounded-sm text-soft-foreground underline decoration-black/20 underline-offset-[3px] outline-none hover:text-foreground focus-visible:shadow-focus"
        >
          {tekstWidoku}
        </a>
      )}
    </td>
  );
}
