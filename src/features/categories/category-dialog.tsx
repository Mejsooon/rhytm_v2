"use client";

// Okno nowej kategorii (albo edycji nazwy i koloru, gdy podano `category`) wg CategoryDialog.dc.html: nazwa, 8 kolorów (zajęte wyblakłe, ale do wyboru),
// podgląd chipu i bloku, „Dodaj kategorię”. Zapisuje przez createCategory i oddaje nową kategorię
// wywołującemu — ten sam komponent obsługuje „+ Kategoria” i „+ Nowa” z okna bloku.
import { useState } from "react";

import { Button, FormDialog, TextField } from "@/components/controls";
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
            return (
              <button
                key={c.hex}
                type="button"
                aria-label={c.name}
                aria-pressed={wybrany}
                onClick={() => setColor(c.hex)}
                // 36 px z makiety; na telefonie 44 px pola dotyku
                className="size-9 cursor-pointer rounded-lg outline-none focus-visible:shadow-focus max-[799px]:size-11"
                style={{
                  background: c.hex,
                  opacity: usedColors.includes(c.hex) && !wybrany ? 0.35 : 1,
                  border: `2px solid ${wybrany ? "#171717" : "#ffffff"}`,
                  boxShadow: `0 0 0 1px ${wybrany ? "#171717" : "#e0e0e0"}`,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        Podgląd
        <div className="flex items-center gap-3 font-normal">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-input bg-white px-2.5 py-1 text-xs text-soft-foreground">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: color }}
            />
            {nazwa || "Kategoria"}{" "}
            <span className="font-mono text-muted-foreground">0</span>
          </span>
          <div
            className="flex-1 rounded-md border border-input px-2.5 py-1.5 text-[13px]"
            style={{ borderLeft: `3px solid ${color}` }}
          >
            <div className="font-medium">Angielski</div>
            <div className="font-mono text-[11px] text-soft-foreground">
              18:00–19:00
            </div>
          </div>
        </div>
      </div>
    </FormDialog>
  );
}
