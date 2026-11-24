"use client";

// Nowa kategoria na telefonie wg CMCategorySheet.dc.html: nagłówek „Anuluj · Nowa kategoria · Dodaj”,
// pole „Nazwa”, siatka kolorów 4×2 (zajęte wyblakłe, ale do wyboru) i „Podgląd” bloku z paskiem koloru.
// Zapisuje tą samą akcją co okno web (createCategory) i oddaje nową kategorię rodzicowi.
import { useState } from "react";

import { Button, Card, FormDialog } from "@/components/controls";
import { createCategory } from "@/features/categories/actions";
import { CATEGORY_COLORS } from "@/features/categories/colors";
import type { NewCategory } from "@/features/categories/category-dialog";

export function MCategorySheet({
  usedColors = [],
  onSaved,
  onCancel,
}: {
  // Kolory istniejących kategorii: wyblakłe, ale nadal do wyboru
  usedColors?: string[];
  onSaved: (category: NewCategory) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [dotkniete, setDotkniete] = useState(false);
  // Domyślnie pierwszy wolny kolor
  const [color, setColor] = useState(
    (
      CATEGORY_COLORS.find((c) => !usedColors.includes(c.hex)) ??
      CATEGORY_COLORS[0]
    ).hex,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const nazwa = name.trim();
  const pusta = nazwa === "";

  async function zapisz() {
    if (pusta || pending) return;
    setPending(true);
    setError("");
    const wynik = await createCategory({ name: nazwa, color });
    setPending(false);
    if (!wynik.ok) {
      setError(wynik.message);
      return;
    }
    onSaved({ id: wynik.id ?? "", name: nazwa, color });
  }

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => !otwarte && !pending && onCancel()}
      title="Nowa kategoria"
      phoneHeader="actions"
      phoneCancel={{
        label: "Anuluj",
        onClick: () => {
          if (!pending) onCancel();
        },
      }}
      phoneSubmit={
        <Button variant="primary" disabled={pusta || pending} onClick={zapisz}>
          Dodaj
        </Button>
      }
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Nazwa
        <input
          type="text"
          value={name}
          maxLength={30}
          placeholder="np. Angielski"
          onChange={(e) => {
            setName(e.target.value);
            setDotkniete(true);
          }}
          onBlur={() => setDotkniete(true)}
          className="h-11 w-full rounded-md border border-input bg-white bg-clip-padding px-3 text-base font-normal shadow-xs outline-none placeholder:text-faint-foreground focus-visible:border-ring focus-visible:shadow-halo"
        />
      </label>
      {dotkniete && pusta && (
        <span className="-mt-2.5 text-xs text-destructive-foreground">
          Nazwa nie może być pusta.
        </span>
      )}
      {error && (
        <p role="alert" className="m-0 text-xs text-destructive-foreground">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Kolor</span>
        <span className="-mt-0.5 text-xs text-muted-foreground">
          Kolor kropki w kalendarzu i w filtrach. Wyblakłe są już zajęte, ale
          można je wybrać.
        </span>
        <div
          role="radiogroup"
          aria-label="Kolor"
          className="mt-1.5 grid grid-cols-4 gap-2"
        >
          {CATEGORY_COLORS.map((c) => {
            const wybrany = c.hex === color;
            const zajety = usedColors.includes(c.hex);
            return (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={wybrany}
                aria-label={c.name}
                onClick={() => setColor(c.hex)}
                className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-input bg-white px-1.5 text-sm font-medium whitespace-nowrap text-foreground shadow-xs outline-none focus-visible:shadow-focus ${zajety && !wybrany ? "opacity-50" : ""}`}
                // Kolor kategorii to dane: pierścień wybranego w jego kolorze
                style={
                  wybrany
                    ? { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${c.hex}` }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  className="size-2 flex-none rounded-full"
                  style={{ background: c.hex }}
                />
                {c.name.slice(0, 5)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Podgląd
        </span>
        <Card className="flex-row items-center gap-2.5 px-3 py-2.5">
          <span
            aria-hidden="true"
            className="h-7 w-1 flex-none rounded-sm"
            style={{ background: color }}
          />
          <span className="font-medium">{nazwa || "Bez nazwy"}</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            18:00–19:00
          </span>
        </Card>
      </div>
    </FormDialog>
  );
}
