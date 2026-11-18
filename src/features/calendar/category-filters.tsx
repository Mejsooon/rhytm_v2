"use client";

// Filtry kategorii schowane w jednym przycisku.
// Web (CalendarNotionWeek.dc.html): „Kategorie 3/4 ▾” z kropkami widocznych kategorii; menu z
// polami wyboru (menuitemcheckbox), na końcu „+ Kategoria”. Esc zamyka, fokus wraca na przycisk.
// Telefon (MCalendarDayFull.dc.html): ikona „Kategorie” (44 px) otwiera dolny arkusz
// z przełącznikiem przy każdej kategorii i „+ Kategoria”.
// Ukrywanie działa tak samo jak dawne chipy: `onToggle` dostaje kategorię, rodzic zapisuje optymistycznie.
import { useRef, useState } from "react";
import { ListFilter, XIcon } from "lucide-react";
import { Dialog, DropdownMenu } from "radix-ui";

import { Switch } from "@/components/controls";
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
      <DropdownMenu.Trigger asChild>
        <button
          ref={przycisk}
          type="button"
          // Czytnik słyszy „Kategorie, widoczne 3 z 4” zamiast sklejonego „Kategorie3/4”
          aria-label={`Kategorie, widoczne ${widoczne.length} z ${categories.length}`}
          className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#e0e0e0] bg-white px-2.5 py-[5px] text-[13px] text-[#171717] outline-none hover:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-[#171717]/20"
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
                    "box-border size-[9px] rounded-full border-[1.5px] border-white",
                    i > 0 && "-ml-1",
                  )}
                  style={{ background: k.color }}
                />
              ))}
            </span>
          )}
          Kategorie
          <span
            aria-hidden="true"
            className="font-mono text-[11px] text-[#6b6b6b]"
          >
            {`${widoczne.length}/${categories.length}`}
          </span>
          <span aria-hidden="true" className="text-[#6b6b6b]">
            ▾
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          onCloseAutoFocus={(e) => {
            if (!otworzOkno.current) return;
            otworzOkno.current = false;
            e.preventDefault();
            przycisk.current?.focus();
            onAdd();
          }}
          className="z-[60] box-border flex w-[220px] flex-col gap-0.5 rounded-[10px] border border-[#e0e0e0] bg-white p-1.5 text-[13px] text-[#171717] shadow-[0_12px_32px_rgba(0,0,0,.12),0_2px_6px_rgba(0,0,0,.06)] outline-none"
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
                className="flex min-h-[34px] cursor-pointer items-center gap-2.5 rounded-md px-2 outline-none select-none data-[highlighted]:bg-[#f5f5f5]"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "box-border inline-flex size-4 flex-none items-center justify-center rounded border text-[11px] text-white",
                    widoczna
                      ? "border-[#171717] bg-[#171717]"
                      : "border-[#c4c4c4] bg-white",
                  )}
                >
                  {widoczna ? "✓" : ""}
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
                <span className={widoczna ? "" : "text-[#6b6b6b]"}>
                  {kategoria.name}
                </span>
              </DropdownMenu.CheckboxItem>
            );
          })}
          <DropdownMenu.Item
            onSelect={() => {
              otworzOkno.current = true;
            }}
            className="mt-1 flex min-h-[34px] cursor-pointer items-center border-t border-[#f0f0f0] px-2 text-[#666666] outline-none select-none data-[highlighted]:bg-[#f5f5f5]"
          >
            + Kategoria
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
          className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] text-[#171717] hover:bg-[#f5f5f5]"
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
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92%] flex-col rounded-t-[18px] bg-white pb-[max(24px,env(safe-area-inset-bottom))] text-[15px] text-[#171717] shadow-[0_-8px_30px_rgba(0,0,0,.12)] outline-none"
        >
          <span
            aria-hidden="true"
            className="mx-auto mt-2 mb-0.5 h-[5px] w-9 flex-none rounded-[3px] bg-[#d4d4d4]"
          />
          <div className="flex flex-none items-center py-1.5 pr-2 pl-4">
            <Dialog.Title className="m-0 flex-1 text-[17px] font-semibold">
              Kategorie
            </Dialog.Title>
            <Dialog.Close
              aria-label="Zamknij"
              className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] text-[#171717] hover:bg-[#f5f5f5]"
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
                className="flex min-h-[52px] cursor-pointer items-center gap-3 border-b border-[#f0f0f0] px-4"
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
              className="flex min-h-[52px] w-full cursor-pointer items-center px-4 text-left text-[#666666]"
            >
              + Kategoria
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
