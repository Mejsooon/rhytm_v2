"use client";

// Arkusz kategorii na telefonie (CMCalendarDay.dc.html): ikona „Kategorie” (44 px) otwiera dolny arkusz
// (FormDialog) z przełącznikiem przy każdej kategorii, źródłami odnowień i wierszem „Kategoria”.
// Na webie kategorie są w lewym panelu (calendar-panel.tsx).
import { useEffect, useRef, useState } from "react";
import { ListFilter, Plus } from "lucide-react";

import {
  Button,
  FormDialog,
  Switch,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import type { CategoryRow, RenewalSource } from "./load-calendar";

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
