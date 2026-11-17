"use client";

// Okno zakresu zmiany wg ScopeDialog.dc.html: tylko to wystąpienie / to i następne / wszystkie.
// Używane przy edycji i usuwaniu wystąpienia bloku cyklicznego.
import { useState } from "react";

import { Button, FormDialog } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { cn } from "@/lib/utils";
import type { Scope } from "./scope";

export function ScopeDialog({
  subtitle,
  date,
  timeLabel,
  intent = "edit",
  disableThis,
  disableFollowing,
  error,
  pending = false,
  onPick,
  onCancel,
}: {
  // Podtytuł, np. „rhytm — kod” · co tydzień we wtorki
  subtitle: string;
  // Data wystąpienia (oryginalna) i jego godziny „10:00–12:30” do opisów opcji
  date: IsoDate;
  timeLabel: string;
  intent?: "edit" | "delete";
  // Powód, dla którego „Tylko to wystąpienie” jest niedostępne (wyjątki nie przechowują kategorii,
  // notatki ani przypomnienia)
  disableThis?: string;
  // Powód, dla którego „To i następne” jest niedostępne (zmiana dnia poza pierwszym wystąpieniem)
  disableFollowing?: string;
  error?: string;
  pending?: boolean;
  onPick: (scope: Scope) => void;
  onCancel: () => void;
}) {
  const [wybrany, setWybrany] = useState<Scope>(
    !disableThis ? "this" : !disableFollowing ? "following" : "all",
  );

  // „wt 17.11” z daty i dnia tygodnia
  const [, miesiac, dzien] = date.split("-");
  const dniTygodnia = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
  const dzienTygodnia = dniTygodnia[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const krotko = `${Number(dzien)}.${miesiac}`;

  const opcje: { value: Scope; tytul: string; opis: string; wylaczona: boolean }[] = [
    {
      value: "this",
      tytul: "Tylko to wystąpienie",
      opis: `${dzienTygodnia} ${krotko} · ${timeLabel}. Inne tygodnie zostają bez zmian.`,
      wylaczona: Boolean(disableThis),
    },
    {
      value: "following",
      tytul: "To i następne",
      opis: `Od ${krotko} w przód. Wcześniejsze wystąpienia zostają.`,
      wylaczona: Boolean(disableFollowing),
    },
    {
      value: "all",
      tytul: "Wszystkie wystąpienia",
      opis: "Zmieni całą serię, także przeszłe tygodnie.",
      wylaczona: false,
    },
  ];

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => !otwarte && onCancel()}
      title={
        intent === "delete" ? "Usuwasz blok, który się powtarza" : "Zmieniasz blok, który się powtarza"
      }
      description={subtitle}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-xs text-[#b91c1c]">
              {error}
            </p>
          )}
          <Button onClick={onCancel}>Anuluj</Button>
          <Button
            variant={intent === "delete" ? "destructive" : "primary"}
            disabled={pending}
            onClick={() => onPick(wybrany)}
          >
            {intent === "delete" ? "Usuń" : "Zapisz zmianę"}
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Zakres zmiany" className="flex flex-col gap-2">
        {opcje.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-3.5 py-3 max-[799px]:min-h-11",
              o.wylaczona ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              wybrany === o.value ? "border-[#171717] bg-[#fafafa]" : "border-[#e0e0e0] bg-white",
            )}
          >
            <input
              type="radio"
              name="zakres"
              checked={wybrany === o.value}
              disabled={o.wylaczona}
              onChange={() => setWybrany(o.value)}
              className="mt-[3px] accent-[#171717]"
            />
            <span>
              <span className="block font-medium">{o.tytul}</span>
              <span className="text-[13px] text-[#666666]">{o.opis}</span>
            </span>
          </label>
        ))}
      </div>
      {disableThis && <p className="m-0 text-xs text-[#6b6b6b]">{disableThis}</p>}
      {disableFollowing && <p className="m-0 text-xs text-[#6b6b6b]">{disableFollowing}</p>}
      <p className="m-0 font-mono text-xs text-[#6b6b6b]">
        Zadania z odhaczonych wystąpień nie przepadają.
      </p>
    </FormDialog>
  );
}
