"use client";

// Filtry kategorii schowane w jednym przycisku.
// Web (CCalendar.dc.html): przycisk .btn „Kategorie 3/4 ⌄” z kropkami widocznych kategorii; menu .pop
// z etykietą „Pokaż w kalendarzu”, polami .cbx (menuitemcheckbox), separatorem i „+ Kategoria”.
// Esc zamyka, fokus wraca na przycisk.
// Telefon (CMCalendarDay.dc.html): ikona „Kategorie” (44 px) otwiera dolny arkusz (FormDialog)
// z przełącznikiem przy każdej kategorii i wierszem „Kategoria” z ikoną plusa.
// Ukrywanie działa tak samo jak dawne chipy: `onToggle` dostaje kategorię, rodzic zapisuje optymistycznie.
// Pod kategoriami stoją źródła odnowień subskrypcji (S2Calendar: „Subscriptions” z przerywanym
// kwadratem zamiast kropki); licznik liczy też je, kropki na przycisku tylko kategorie.
import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDown, ListFilter, Plus } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import {
  Button,
  FormDialog,
  MENU_ITEM,
  MENU_LABEL,
  MENU_SEPARATOR,
  StatusBadge,
  Switch,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import type { CategoryRow, RenewalSource } from "./load-calendar";

export function CategoryFilters({
  categories,
  onToggle,
  onAdd,
  sources = [],
  onToggleSource = () => {},
}: {
  categories: CategoryRow[];
  onToggle: (category: CategoryRow) => void;
  // „+ Kategoria”: rodzic otwiera CategoryDialog
  onAdd: () => void;
  // Źródła odnowień (pola Data odnowienia); przełączenie zapisuje show_in_calendar pola
  sources?: RenewalSource[];
  onToggleSource?: (source: RenewalSource) => void;
}) {
  const widoczne = categories.filter((k) => !k.hidden);
  const widoczneRazem = widoczne.length + sources.filter((z) => z.shown).length;
  const wszystkie = categories.length + sources.length;
  const przycisk = useRef<HTMLButtonElement>(null);
  // „+ Kategoria” otwiera okno dopiero po zamknięciu menu, gdy fokus jest już na przycisku,
  // żeby okno po zamknięciu oddało fokus właśnie tam
  const otworzOkno = useRef(false);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild ref={przycisk}>
        <Button
          // Czytnik słyszy „Kategorie, widoczne 3 z 4” zamiast sklejonego „Kategorie3/4”
          aria-label={`Kategorie, widoczne ${widoczneRazem} z ${wszystkie}`}
        >
          {widoczne.length > 0 && (
            <span
              aria-hidden="true"
              data-testid="kropki-kategorii"
              className="inline-flex"
            >
              {widoczne.slice(0, 4).map((k, i) => (
                <span
                  key={k.id}
                  className={cn(
                    // Makieta: 9 px + ramka 1,5 px z każdej strony (content-box) = 12 px
                    "box-border size-3 rounded-full border-[1.5px] border-white",
                    i > 0 && "-ml-1",
                  )}
                  style={{ background: k.color }}
                />
              ))}
            </span>
          )}
          Kategorie
          <span aria-hidden="true" className="inline-flex">
            <StatusBadge tone="gray" className="tabular-nums">
              {`${widoczneRazem}/${wszystkie}`}
            </StatusBadge>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          onCloseAutoFocus={(e) => {
            if (!otworzOkno.current) return;
            otworzOkno.current = false;
            e.preventDefault();
            przycisk.current?.focus();
            onAdd();
          }}
          // .pop z makiety: promień 12 px, ramka, cień lg, padding 4 px
          className="z-[60] box-border flex w-[230px] flex-col rounded-lg border border-border bg-white bg-clip-padding p-1 text-sm text-foreground shadow-lg outline-none"
        >
          <DropdownMenu.Label className={MENU_LABEL}>
            Pokaż w kalendarzu
          </DropdownMenu.Label>
          {categories.map((kategoria) => {
            const widoczna = !kategoria.hidden;
            return (
              <DropdownMenu.CheckboxItem
                key={kategoria.id}
                checked={widoczna}
                // Menu zostaje otwarte, żeby przełączyć kilka kategorii naraz
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => onToggle(kategoria)}
                className={cn(
                  MENU_ITEM,
                  "select-none data-[highlighted]:bg-accent",
                )}
              >
                {/* Kwadrat .cbx (16 px) — tylko wygląd, stan niesie menuitemcheckbox */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "box-border grid size-4 flex-none place-items-center rounded-[4px] border shadow-xs",
                    widoczna
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-white text-transparent",
                  )}
                >
                  <CheckIcon strokeWidth={3} className="size-3" />
                </span>
                <span
                  aria-hidden="true"
                  className="box-border size-2 flex-none rounded-full"
                  style={
                    widoczna
                      ? { background: kategoria.color }
                      : { border: `1.5px solid ${kategoria.color}` }
                  }
                />
                <span className={widoczna ? "" : "text-muted-foreground"}>
                  {kategoria.name}
                </span>
              </DropdownMenu.CheckboxItem>
            );
          })}
          {sources.map((zrodlo) => (
            <DropdownMenu.CheckboxItem
              key={zrodlo.fieldId}
              checked={zrodlo.shown}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onToggleSource(zrodlo)}
              className={cn(
                MENU_ITEM,
                "select-none data-[highlighted]:bg-accent",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "box-border grid size-4 flex-none place-items-center rounded-[4px] border shadow-xs",
                  zrodlo.shown
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-white text-transparent",
                )}
              >
                <CheckIcon strokeWidth={3} className="size-3" />
              </span>
              {/* Przerywany kwadrat 10×8 px zamiast kropki: ciemny przy widocznym, szary przy ukrytym */}
              <span
                aria-hidden="true"
                data-testid="znacznik-zrodla"
                className="box-border h-2 w-2.5 flex-none rounded-[2px] border border-dashed"
                style={{ borderColor: zrodlo.shown ? "#404040" : "#a3a3a3" }}
              />
              <span
                className={cn(
                  "min-w-0 truncate",
                  !zrodlo.shown && "text-muted-foreground",
                )}
              >
                {zrodlo.name}
              </span>
            </DropdownMenu.CheckboxItem>
          ))}
          <DropdownMenu.Separator className={MENU_SEPARATOR} />
          <DropdownMenu.Item
            onSelect={() => {
              otworzOkno.current = true;
            }}
            className={cn(
              MENU_ITEM,
              "text-muted-foreground select-none data-[highlighted]:bg-accent",
            )}
          >
            {/* Wygląd jak w makiecie (ikona + „Kategoria”), nazwa dostępna bez zmian: „+ Kategoria” */}
            <Plus size={16} aria-hidden="true" />
            <span>
              <span className="sr-only">+</span> Kategoria
            </span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function CategorySheet({
  categories,
  onToggle,
  onAdd,
  sources = [],
  onToggleSource = () => {},
}: {
  categories: CategoryRow[];
  onToggle: (category: CategoryRow) => void;
  onAdd: () => void;
  sources?: RenewalSource[];
  onToggleSource?: (source: RenewalSource) => void;
}) {
  const [otwarty, setOtwarty] = useState(false);
  const przycisk = useRef<HTMLButtonElement | null>(null);
  // Jak w menu web: okno nowej kategorii otwiera się po zamknięciu arkusza
  const otworzOkno = useRef(false);

  // Po zamknięciu arkusza z „Kategoria”: fokus wraca na ikonę, potem otwiera się okno nowej kategorii
  useEffect(() => {
    if (otwarty || !otworzOkno.current) return;
    otworzOkno.current = false;
    przycisk.current?.focus();
    onAdd();
  }, [otwarty, onAdd]);

  return (
    <>
      <Button
        variant="ghost"
        icon
        aria-label="Kategorie"
        aria-haspopup="dialog"
        onClick={(e) => {
          // Zapamiętany przycisk dostaje fokus po zamknięciu arkusza
          przycisk.current = e.currentTarget;
          setOtwarty(true);
        }}
      >
        <ListFilter size={20} aria-hidden="true" />
      </Button>
      <FormDialog open={otwarty} onOpenChange={setOtwarty} title="Kategorie">
        {/* Wiersze na pełną szerokość arkusza (m-row sam daje odstęp 16 px) */}
        <div className="-mx-5 -mb-5 border-t border-border">
          {categories.map((kategoria) => (
            // Cały wiersz przełącza kategorię; stuknięcie w sam przełącznik obsługuje on sam
            // (sprawdzamy cel kliknięcia, żeby nie przełączyć dwa razy)
            <div
              key={kategoria.id}
              data-testid={`wiersz-kategorii-${kategoria.id}`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[role=switch]")) return;
                onToggle(kategoria);
              }}
              className="m-row cursor-pointer"
            >
              <span
                aria-hidden="true"
                className="size-2.5 flex-none rounded-full"
                style={{ background: kategoria.color }}
              />
              <span className="min-w-0 flex-1 truncate">{kategoria.name}</span>
              <Switch
                checked={!kategoria.hidden}
                onChange={() => onToggle(kategoria)}
                ariaLabel={`Pokaż kategorię ${kategoria.name}`}
              />
            </div>
          ))}
          {sources.map((zrodlo) => (
            <div
              key={zrodlo.fieldId}
              data-testid={`wiersz-zrodla-${zrodlo.fieldId}`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[role=switch]")) return;
                onToggleSource(zrodlo);
              }}
              className="m-row cursor-pointer"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "box-border h-2 w-2.5 flex-none rounded-[2px] border border-dashed",
                  zrodlo.shown
                    ? "border-foreground"
                    : "border-muted-foreground",
                )}
              />
              <span className="min-w-0 flex-1 truncate">{zrodlo.name}</span>
              <Switch
                checked={zrodlo.shown}
                onChange={() => onToggleSource(zrodlo)}
                ariaLabel={`Pokaż odnowienia ${zrodlo.name}`}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              otworzOkno.current = true;
              setOtwarty(false);
            }}
            className="m-row w-full cursor-pointer text-left text-muted-foreground"
          >
            <Plus size={16} aria-hidden="true" />
            Kategoria
          </button>
        </div>
      </FormDialog>
    </>
  );
}
