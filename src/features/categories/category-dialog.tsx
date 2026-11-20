"use client";

// Okno nowej kategorii (albo edycji nazwy i koloru, gdy podano `category`) wg CategoryDialog.dc.html: nazwa, 8 kolorów (zajęte wyblakłe, ale do wyboru),
// podgląd chipu i bloku, „Dodaj kategorię”. Zapisuje przez createCategory i oddaje nową kategorię
// wywołującemu — ten sam komponent obsługuje „+ Kategoria” i „+ Nowa” z okna bloku.
import type { CSSProperties } from "react";
import { useState } from "react";

import { Button, FormDialog, TextField } from "@/components/controls";
import { cn } from "@/lib/utils";
import { createCategory, updateCategory } from "./actions";
import { CATEGORY_COLORS } from "./colors";

export type NewCategory = { id: string; name: string; color: string };

export function CategoryDialog({
  category,
  usedColors = [],
  onSaved,
  onCancel,
}: {
  // Tryb edycji: kategoria własna do zmiany nazwy i koloru (bez niej — tworzenie nowej)
  category?: NewCategory;
  // Kolory istniejących kategorii: wyblakłe, ale nadal do wyboru
  usedColors?: string[];
  onSaved: (category: NewCategory) => void;
  onCancel: () => void;
}) {
  const edycja = category !== undefined;
  const [name, setName] = useState(category?.name ?? "");
  // Domyślnie pierwszy wolny kolor (jak w makiecie, gdzie zajęte są pierwsze cztery)
  const [color, setColor] = useState(
    category?.color ??
      (
        CATEGORY_COLORS.find((c) => !usedColors.includes(c.hex)) ??
        CATEGORY_COLORS[0]
      ).hex,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const nazwa = name.trim();

  async function zapisz() {
    if (nazwa === "" || pending) return;
    setPending(true);
    setError("");
    const wynik = category
      ? await updateCategory({ id: category.id, name: nazwa, color })
      : await createCategory({ name: nazwa, color });
    setPending(false);
    if (!wynik.ok) {
      setError(wynik.message);
      return;
    }
    onSaved({ id: category?.id ?? wynik.id ?? "", name: nazwa, color });
  }

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => !otwarte && onCancel()}
      title={edycja ? "Edytuj kategorię" : "Nowa kategoria"}
      description="Kolor kropki w kalendarzu i w filtrach."
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-xs text-destructive-foreground">
              {error}
            </p>
          )}
          <Button onClick={onCancel}>Anuluj</Button>
          <Button
            variant="primary"
            disabled={nazwa === "" || pending}
            onClick={zapisz}
          >
            {edycja ? "Zapisz" : "Dodaj kategorię"}
          </Button>
        </>
      }
    >
      <TextField
        label="Nazwa"
        value={name}
        maxLength={30}
        autoFocus
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        <span>
          Kolor{" "}
          <span className="font-normal text-muted-foreground text-xs">
            wyblakłe są już zajęte, ale można je wybrać
          </span>
        </span>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => {
            const wybrany = c.hex === color;
            const zajety = usedColors.includes(c.hex);
            return (
              <button
                key={c.hex}
                type="button"
                aria-label={c.name}
                aria-pressed={wybrany}
                onClick={() => setColor(c.hex)}
                // 36 px z makiety (promień 10 px, biała ramka 2 px); na telefonie 44 px pola dotyku.
                // Wybrany: pierścień 2 px w swoim kolorze; fokus jako obrys poza pierścieniem, żeby go nie zasłonić
                className={cn(
                  "size-9 cursor-pointer rounded-md border-2 border-white p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring focus-visible:outline-solid max-[799px]:size-11",
                  wybrany
                    ? "shadow-[0_0_0_2px_var(--kolor)]"
                    : "shadow-[inset_0_0_0_1px_rgba(0,0,0,.08),0_1px_2px_rgba(0,0,0,.05)]",
                  // Zajęty, niewybrany: blaknie tylko kolor pola (nie opacity), żeby obrys fokusu był w pełni widoczny
                  zajety && !wybrany
                    ? "bg-[color-mix(in_srgb,var(--kolor)_35%,white)]"
                    : "bg-(--kolor)",
                )}
                style={
                  {
                    "--kolor": c.hex,
                  } as CSSProperties
                }
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        Podgląd
        {/* .frame z makiety (tylko web — na telefonie układ bez ramki jak dotąd); chip w stanie
            wybranym z licznikiem, blok według reguły bloku */}
        <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-black/[.14] bg-white p-3 font-normal max-[799px]:border-0 max-[799px]:p-0">
          <span className="inline-flex h-7 flex-none items-center gap-1.5 rounded-[8px] border border-black/[.18] bg-muted px-[9px] text-sm font-medium whitespace-nowrap text-foreground">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: color }}
            />
            {nazwa || "Kategoria"}{" "}
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-muted px-[5px] text-[11px] tabular-nums">
              0
            </span>
          </span>
          <div
            className="min-w-0 flex-1 rounded-md px-3 py-[7px] text-sm"
            style={{
              background: `${color}12`,
              border: `1px solid ${color}4d`,
            }}
          >
            <div className="font-medium">Angielski</div>
            <div className="text-xs text-soft-foreground tabular-nums">
              18:00–19:00
            </div>
          </div>
        </div>
      </div>
    </FormDialog>
  );
}
