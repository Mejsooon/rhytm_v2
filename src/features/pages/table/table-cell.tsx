"use client";

import * as React from "react";

import {
  ActionPopover,
  Button,
  Checkbox,
  DatePicker,
  StatusBadge,
  type IsoDate,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { OptionBadge } from "./option-badge";
import { OptionPicker } from "./option-picker";
import { SecretTableCell } from "./secret-table-cell";
import {
  formatMoney,
  formatValue,
  isRecurringValue,
  isUrgent,
  nextRenewal,
  renewalDates,
  normalizeValue,
  relativeDue,
  rowActive,
  rowCycle,
  type Cycle,
  type PageField,
} from "../fields";
import type { PageRow } from "../table-model";

// Przerwa w pisaniu, po której szkic tekstu trafia do zapisu
const OPOZNIENIE_ZAPISU = 600;

// Komórka .td z S2Books.dc.html: wiersz 44 px, dolna linia (bez niej w ostatnim wierszu), najechanie podświetla o 2 %
const TD =
  "h-11 truncate border-b border-border group-last/wiersz:border-b-0 hover:bg-black/[.02]";
// Komórka w edycji (.celltxt:focus-within): niebieska obwódka do środka i białe tło
const OBWODKA =
  "focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]";

// Jedna komórka tabeli edytowana wprost, jak w Notion (S2Books.dc.html). Tekst, liczba i link to stałe
// pole bez ramki: zapis po 600 ms przerwy oraz od razu przy Enter, Esc, wyjściu i odmontowaniu.
// Gwiazdki, checkbox i data zapisują od razu. Select i status pokazują plakietkę (klik otwiera okienko opcji).
// Kwota cykliczna to pole kwoty (zapis jak liczba) z „zł” i przyciskiem cyklu; Data odnowienia pokazuje następne
// odnowienie i czas do niego (S2Main.dc.html).
// Sekret to SecretTableCell (szyfrowanie przy zapisie). `readOnly` (moduł Hasła przy zamkniętym sejfie)
// pokazuje wartość jako zwykły tekst, bez edycji.
export function TableCell({
  row,
  field,
  fields,
  today,
  done,
  autoFocus = false,
  readOnly = false,
  revealed = false,
  onToggleReveal,
  onCopied,
  onSave,
  onFocused,
  onCreateOption,
  onUpdateOption,
  onRemoveOption,
}: {
  row: PageRow;
  field: PageField;
  // Wszystkie pola tabeli: Data odnowienia bierze z nich cykl wiersza i „Aktywną”
  fields: PageField[];
  today: IsoDate;
  // Opcja „zrobione” z karty najbliższego terminu — zrobione terminy nie są pilne
  done: { fieldId: string; optionId: string } | null;
  // Kursor w tej komórce (tytuł nowego wiersza po „+ Nowy”)
  autoFocus?: boolean;
  // Komórka bez edycji (zwykły tekst)
  readOnly?: boolean;
  // Sekret: odsłonięty oczkiem wiersza (tekst zamiast maski)
  revealed?: boolean;
  // Sekret w module Hasła: oczko wiersza i informacja o skopiowaniu (komórka sama zapisuje schowek)
  onToggleReveal?: () => void;
  onCopied?: () => void;
  onSave: (value: unknown) => void;
  // Wołane po fokusie pola (np. by wyczyścić „kursor w nowym wierszu”)
  onFocused?: () => void;
  // Opcje select/status tworzone, zmieniane i usuwane z okienka komórki
  onCreateOption?: (label: string) => Promise<string | null>;
  onUpdateOption?: (
    id: string,
    patch: { label?: string; color?: string },
  ) => void;
  onRemoveOption?: (id: string) => void;
}) {
  const v = normalizeValue(field, row.values[field.id]);

  // Szkic tekstu w komórce z fokusem; null = komórka pokazuje wartość z magazynu.
  // Dopóki komórka ma fokus, nowa wartość z serwera nie nadpisuje tego, co się pisze.
  const [szkic, setSzkic] = React.useState<string | null>(null);
  const poleRef = React.useRef<HTMLInputElement>(null);
  // Okienko opcji (select i status)
  const [okienko, setOkienko] = React.useState(false);
  const panelOpcji = React.useRef<{
    otwarty: boolean;
    wstecz: () => void;
  } | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Wpisana, a jeszcze niezapisana wartość (null = nic do zapisu; Kwota cykliczna zapisuje też null, stąd opakowanie)
  // i najnowsze onSave — dla zapisu przy odmontowaniu
  const niezapisany = React.useRef<{ wartosc: unknown } | null>(null);
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
      if (n.current !== null) z.current(n.current.wartosc);
      n.current = null;
    };
  }, []);

  // Zapis szkicu teraz (Enter, Esc, wyjście z komórki, koniec przerwy w pisaniu)
  function zapiszSzkic() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const szkicZapisu = niezapisany.current;
    niezapisany.current = null;
    if (szkicZapisu !== null) zapisz.current(szkicZapisu.wartosc);
  }

  // Sekret: maska, oczko i edycja z szyfrowaniem (szyfrogramu nigdy nie pokazujemy)
  if (field.type === "secret") {
    return (
      <td className={cn(TD, "p-0", !readOnly && OBWODKA)}>
        <SecretTableCell
          row={row}
          field={field}
          readOnly={readOnly}
          revealed={revealed}
          onSave={onSave}
          onToggleReveal={onToggleReveal}
          onCopied={onCopied}
        />
      </td>
    );
  }

  // Tylko do odczytu: wartość jako zwykły tekst (S2Passwords, zablokowany sejf)
  if (readOnly) {
    return (
      <td className={cn(TD, "px-3 text-soft-foreground", field.isTitle && "font-medium")}>
        {formatValue(field, v) || "—"}
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
          // Esc w panelu edycji opcji wraca do listy, dopiero drugi zamyka okienko
          onEscapeKeyDown={(e) => {
            if (panelOpcji.current?.otwarty) {
              e.preventDefault();
              panelOpcji.current.wstecz();
            }
          }}
          ariaLabel={field.name}
          trigger={
            <button
              type="button"
              // Czytnik ekranu słyszy pole i wartość („Status: Czytam”), bo etykieta zastępuje treść przycisku
              aria-label={`${field.name}: ${opcja?.label ?? "puste"}`}
              className="flex h-11 w-full cursor-pointer items-center border-0 bg-transparent px-3 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]"
            >
              {opcja ? (
                <span className="flex min-w-0">
                  <OptionBadge option={opcja} />
                </span>
              ) : (
                <span className="text-faint-foreground">—</span>
              )}
            </button>
          }
        >
          <OptionPicker
            panelRef={panelOpcji}
            field={field}
            value={typeof v === "string" ? v : null}
            onPick={(id) => {
              onSave(id);
              setOkienko(false);
            }}
            onCreate={(label) =>
              onCreateOption?.(label) ?? Promise.resolve(null)
            }
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
        <span
          role="group"
          aria-label={field.name}
          className="inline-flex gap-px"
        >
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
        <Checkbox
          checked={v === true}
          ariaLabel={field.name}
          onChange={(c) => onSave(c)}
        />
      </td>
    );
  }

  if (field.type === "date") {
    const zrobiony =
      done !== null && row.values[done.fieldId] === done.optionId;
    // Termin w kalendarzu pokazuje też czas do terminu; pilny to czerwona odznaka (.bdg.bad)
    const wzgledna =
      typeof v === "string" && field.config.show_in_calendar === true
        ? relativeDue(v, today).text
        : "";
    const pilny = typeof v === "string" && isUrgent(v, today, zrobiony);
    return (
      // Otwarty kalendarz (aria-expanded na wyzwalaczu) też daje niebieską obwódkę komórki
      <td
        className={cn(
          TD,
          "p-0 has-[[aria-expanded=true]]:bg-white has-[[aria-expanded=true]]:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)] has-[:focus-visible]:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]",
        )}
      >
        {/* Czas do terminu stoi tuż za datą (odstęp 6 px, S2Projects.dc.html). Klik w puste miejsce komórki
            otwiera kalendarz jak klik w datę; klik w dymku (portal poza tym divem w DOM) się nie liczy. */}
        <div
          className="flex h-11 cursor-pointer items-center gap-1.5 overflow-hidden pr-3 whitespace-nowrap"
          onClick={(e) => {
            const wyzwalacz = e.currentTarget.querySelector("button");
            const cel = e.target as Node;
            if (wyzwalacz && e.currentTarget.contains(cel) && !wyzwalacz.contains(cel)) wyzwalacz.click();
          }}
        >
          <DatePicker
            variant="bare"
            // Pole i data dla czytnika ekranu („Termin: 20.11.2026”), jak w komórce wyboru
            ariaLabel={`${field.name}: ${typeof v === "string" ? formatValue(field, v) : "puste"}`}
            placeholder="—"
            today={today}
            value={typeof v === "string" ? (v as IsoDate) : null}
            onChange={(d) => onSave(d)}
            // Fokus z klawiatury obrysowuje całą komórkę (has-[:focus-visible] na td); bez czasu do terminu na całą szerokość
            className={cn(
              "h-11 min-w-0 justify-start rounded-none pl-3 text-sm tabular-nums focus-visible:shadow-none",
              wzgledna ? "flex-none" : "flex-1",
            )}
          />
          {wzgledna &&
            (pilny ? (
              <StatusBadge tone="red" className="min-w-0">
                {wzgledna}
              </StatusBadge>
            ) : (
              <span className="min-w-0 truncate text-muted-foreground">{wzgledna}</span>
            ))}
        </div>
      </td>
    );
  }

  if (field.type === "renewal") {
    const kotwica = typeof v === "string" ? v : null;
    // Wyświetlamy następne odnowienie (od dziś według cyklu wiersza), a zapisujemy kotwicę serii
    const cykl = rowCycle(field, fields, row.values);
    const nastepne = kotwica === null ? null : nextRenewal(kotwica, cykl, today);
    const aktywny = rowActive(field, fields, row.values);
    const wzgledna = nastepne === null ? null : relativeDue(nastepne, today);
    // Za datą: „anulowana” w wierszu nieaktywnym (także bez daty, jak relTxt w S2Main), inaczej czas do odnowienia
    const zaData = !aktywny || wzgledna !== null;
    return (
      // Otwarty kalendarz (aria-expanded na wyzwalaczu) daje niebieską obwódkę komórki, jak w dacie
      <td
        className={cn(
          TD,
          "p-0 has-[[aria-expanded=true]]:bg-white has-[[aria-expanded=true]]:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)] has-[:focus-visible]:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]",
        )}
      >
        {/* Czas do odnowienia tuż za datą (odstęp 6 px); klik w puste miejsce komórki otwiera kalendarz */}
        <div
          className="flex h-11 cursor-pointer items-center gap-1.5 overflow-hidden pr-3 whitespace-nowrap"
          onClick={(e) => {
            const wyzwalacz = e.currentTarget.querySelector("button");
            const cel = e.target as Node;
            if (wyzwalacz && e.currentTarget.contains(cel) && !wyzwalacz.contains(cel)) wyzwalacz.click();
          }}
        >
          <DatePicker
            variant="bare"
            ariaLabel={`${field.name}: ${nastepne !== null ? formatValue(field, nastepne) : "puste"}`}
            placeholder="—"
            today={today}
            // Kalendarz otwiera się na następnym odnowieniu: wybór tej samej daty nie zmienia serii
            value={nastepne as IsoDate | null}
            onChange={(d) => {
              // Data już należąca do serii nie zmienia kotwicy (inaczej seria dryfuje: 31.01 → 28.02 → 28.03)
              if (d !== null && kotwica !== null && renewalDates(kotwica, cykl, d, d).length > 0) return;
              onSave(d);
            }}
            className={cn(
              "h-11 min-w-0 justify-start rounded-none pl-3 text-sm tabular-nums focus-visible:shadow-none",
              zaData ? "flex-none" : "flex-1",
            )}
          />
          {zaData &&
            (!aktywny ? (
              // Wiersz nieaktywny: szara plakietka zamiast czasu do odnowienia (S2Main relC → .bdg.sec)
              <StatusBadge tone="gray" className="min-w-0">
                anulowana
              </StatusBadge>
            ) : wzgledna !== null && wzgledna.days >= 0 && wzgledna.days <= 10 ? (
              // 0–10 dni do odnowienia: pomarańczowa plakietka (.bdg.warn)
              <StatusBadge tone="orange" className="min-w-0">
                {wzgledna.text}
              </StatusBadge>
            ) : (
              <span className="min-w-0 truncate text-muted-foreground">{wzgledna?.text}</span>
            ))}
        </div>
      </td>
    );
  }

  if (field.type === "recurring") {
    const kwota = isRecurringValue(v) ? v : null;
    // Kwota w szkicu (null = pusty albo niepoprawny tekst); bez szkicu kwota z magazynu
    const zSzkicu = szkic === null ? null : normalizeValue(field, szkic.replace(/[\s\u00a0]/g, ""));
    const kwotaSzkicu =
      szkic === null ? (kwota?.amount ?? null) : isRecurringValue(zSzkicu) ? zSzkicu.amount : null;
    // Przy pustej kwocie przycisk pokazuje cykl domyślny pola
    const cykl: Cycle = kwota?.cycle ?? field.config.default_cycle ?? "month";
    const cyklTekst = cykl === "month" ? "mies." : "rok";
    return (
      <td className={cn(TD, "relative cursor-text p-0 text-foreground tabular-nums", OBWODKA)}>
        {/* Kolejność z S2Main (isMoney): kwota do prawej, szare „zł” 13 px i przycisk cyklu; odstęp 4 px */}
        <span className="flex h-11 items-center justify-end gap-1 px-3">
          <input
            ref={poleRef}
            type="text"
            inputMode="decimal"
            aria-label={field.name}
            value={szkic ?? (kwota ? formatMoney(kwota.amount) : "")}
            placeholder="0,00"
            onFocus={() => {
              setSzkic(kwota ? formatMoney(kwota.amount) : "");
              onFocused?.();
            }}
            onChange={(e) => {
              const t = e.target.value;
              setSzkic(t);
              // Spacje (także twarde z formatu) nie przeszkadzają w odczycie kwoty
              const czysty = t.replace(/[\s\u00a0]/g, "");
              const n = normalizeValue(field, czysty);
              // Pusty tekst czyści kwotę; niepoprawny nie idzie do zapisu (po wyjściu wraca poprzednia wartość)
              const zla = czysty !== "" && !isRecurringValue(n);
              niezapisany.current = zla
                ? null
                : { wartosc: czysty === "" || !isRecurringValue(n) ? null : { amount: n.amount, cycle: cykl } };
              if (timer.current) clearTimeout(timer.current);
              timer.current = zla ? null : setTimeout(zapiszSzkic, OPOZNIENIE_ZAPISU);
            }}
            onBlur={() => {
              zapiszSzkic();
              setSzkic(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="block h-11 w-full min-w-0 flex-1 truncate rounded-none border-0 bg-transparent p-0 text-right font-[inherit] text-inherit shadow-none outline-none placeholder:font-normal placeholder:text-faint-foreground focus:shadow-none focus-visible:shadow-none"
          />
          <span className="flex-none text-[13px] text-muted-foreground">zł</span>
          <Button
            variant="ghost"
            size="xs"
            disabled={kwotaSzkicu === null}
            aria-label={`Cykl: ${cyklTekst} (kliknij, aby zmienić)`}
            // Klik nie zabiera fokusu z pola kwoty: szkic i nowy cykl idą w jednym zapisie
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (kwotaSzkicu === null) return;
              if (timer.current) clearTimeout(timer.current);
              timer.current = null;
              niezapisany.current = null;
              onSave({ amount: kwotaSzkicu, cycle: cykl === "month" ? "year" : "month" });
            }}
            className="flex-none px-1 text-muted-foreground"
          >
            / {cyklTekst}
          </Button>
        </span>
      </td>
    );
  }

  // Tekst, liczba i link: stałe pole bez ramki, wyglądające jak tekst
  const tekstWidoku =
    field.type === "text"
      ? typeof v === "string"
        ? v
        : ""
      : formatValue(field, v);
  const tekstEdycji =
    v === null
      ? ""
      : field.type === "number"
        ? String(v).replace(".", ",")
        : String(v);
  const adres =
    field.type === "url" && typeof v === "string"
      ? /^https?:\/\//i.test(v)
        ? v
        : `https://${v}`
      : null;
  // Link poza edycją leży nad polem: klik w link otwiera adres, klik obok stawia kursor w polu
  const pokazLink = adres !== null && szkic === null;

  return (
    <td
      className={cn(
        TD,
        "relative cursor-text p-0",
        OBWODKA,
        // Tekst wszystkich kolumn ciemny (decyzja po kroku 2); tytuł dodatkowo pogrubiony
        field.isTitle ? "font-medium text-foreground" : "text-foreground",
        (field.type === "number" || field.type === "url") && "tabular-nums",
      )}
    >
      <input
        ref={poleRef}
        type="text"
        inputMode={field.type === "number" ? "decimal" : undefined}
        aria-label={field.name}
        value={szkic ?? tekstWidoku}
        placeholder={
          field.isTitle ? (field.config.empty_label ?? "Bez tytułu") : "—"
        }
        onFocus={() => {
          setSzkic(tekstEdycji);
          onFocused?.();
        }}
        onChange={(e) => {
          const t = e.target.value;
          setSzkic(t);
          // Niepoprawna liczba nie idzie do zapisu: po wyjściu komórka wraca do poprzedniej wartości
          const zla =
            field.type === "number" &&
            t.trim() !== "" &&
            normalizeValue(field, t) === null;
          niezapisany.current = zla ? null : { wartosc: t };
          if (timer.current) clearTimeout(timer.current);
          timer.current = zla
            ? null
            : setTimeout(zapiszSzkic, OPOZNIENIE_ZAPISU);
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
          // Wygląda jak zwykły tekst (S2Websites), podkreślenie dopiero po najechaniu
          className="absolute top-1/2 left-3 block max-w-[calc(100%-24px)] -translate-y-1/2 truncate rounded-sm text-foreground decoration-black/30 underline-offset-[3px] outline-none hover:underline focus-visible:shadow-focus"
        >
          {tekstWidoku}
        </a>
      )}
    </td>
  );
}
