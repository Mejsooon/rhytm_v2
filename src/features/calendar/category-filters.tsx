"use client";

// Filtry kategorii schowane w jednym przycisku.
// Web (CCalendar.dc.html): przycisk .btn „Kategorie 3/4 ⌄” z kropkami widocznych kategorii; menu .pop
// z polami .cbx (menuitemcheckbox), separatorem i „+ Kategoria”.
// Esc zamyka, fokus wraca na przycisk.
// Telefon (MCalendarDayFull.dc.html): ikona „Kategorie” (44 px) otwiera dolny arkusz
// z przełącznikiem przy każdej kategorii i „+ Kategoria”.
// Ukrywanie działa tak samo jak dawne chipy: `onToggle` dostaje kategorię, rodzic zapisuje optymistycznie.
import { useRef, useState } from "react";
import { CheckIcon, ChevronDown, ListFilter, Plus, XIcon } from "lucide-react";
import { Dialog, DropdownMenu } from "radix-ui";

import {
  Button,
  MENU_ITEM,
  MENU_SEPARATOR,
  StatusBadge,
  Switch,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "./load-calendar";

export function CategoryFilters({
  categories,
  onToggle,
  onAdd,
}: {
  categories: CategoryRow[];
  onToggle: (category: CategoryRow) => void;
  // „+ Kategoria”: rodzic otwiera CategoryDialog
  onAdd: () => void;
}) {
  const widoczne = categories.filter((k) => !k.hidden);
  const przycisk = useRef<HTMLButtonElement>(null);
  // „+ Kategoria” otwiera okno dopiero po zamknięciu menu, gdy fokus jest już na przycisku,
  // żeby okno po zamknięciu oddało fokus właśnie tam
  const otworzOkno = useRef(false);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild ref={przycisk}>
        <Button
          // Czytnik słyszy „Kategorie, widoczne 3 z 4” zamiast sklejonego „Kategorie3/4”
          aria-label={`Kategorie, widoczne ${widoczne.length} z ${categories.length}`}
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
              {`${widoczne.length}/${categories.length}`}
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
}: {
  categories: CategoryRow[];
  onToggle: (category: CategoryRow) => void;
  onAdd: () => void;
}) {
  const [otwarty, setOtwarty] = useState(false);
  const przycisk = useRef<HTMLButtonElement>(null);
  // Jak w menu web: okno nowej kategorii otwiera się po zamknięciu arkusza
  const otworzOkno = useRef(false);

  return (
    <Dialog.Root open={otwarty} onOpenChange={setOtwarty}>
      <Dialog.Trigger asChild>
        <button
          ref={przycisk}
          type="button"
          aria-label="Kategorie"
          className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-muted"
        >
          <ListFilter size={21} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            if (!otworzOkno.current) return;
            otworzOkno.current = false;
            e.preventDefault();
            przycisk.current?.focus();
            onAdd();
          }}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92%] flex-col rounded-t-[18px] bg-white pb-[max(24px,env(safe-area-inset-bottom))] text-[15px] text-foreground shadow-[0_-8px_30px_rgba(0,0,0,.12)] outline-none"
        >
          <span
            aria-hidden="true"
            className="mx-auto mt-2 mb-0.5 h-[5px] w-9 flex-none rounded-[3px] bg-border-strong"
          />
          <div className="flex flex-none items-center py-1.5 pr-2 pl-4">
            <Dialog.Title className="m-0 flex-1 text-[17px] font-semibold">
              Kategorie
            </Dialog.Title>
            <Dialog.Close
              aria-label="Zamknij"
              className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-muted"
            >
              <XIcon size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {categories.map((kategoria) => (
              // Cały wiersz 52 px przełącza kategorię; stuknięcie w sam przełącznik obsługuje on sam
              // (sprawdzamy cel kliknięcia, żeby nie przełączyć dwa razy)
              <div
                key={kategoria.id}
                data-testid={`wiersz-kategorii-${kategoria.id}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[role=switch]"))
                    return;
                  onToggle(kategoria);
                }}
                className="flex min-h-[52px] cursor-pointer items-center gap-3 border-b border-border px-4"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 flex-none rounded-full"
                  style={{ background: kategoria.color }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {kategoria.name}
                </span>
                <Switch
                  checked={!kategoria.hidden}
                  onChange={() => onToggle(kategoria)}
                  ariaLabel={`Pokaż kategorię ${kategoria.name}`}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                otworzOkno.current = true;
                setOtwarty(false);
              }}
              className="flex min-h-[52px] w-full cursor-pointer items-center px-4 text-left text-muted-foreground"
            >
              + Kategoria
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
